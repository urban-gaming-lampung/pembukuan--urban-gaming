import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Validates whether the caller has administrator privileges.
 */
async function verifyAdmin(auth: any): Promise<boolean> {
  if (!auth) return false;
  const email = (auth.token?.email || '').toLowerCase().trim();
  if (email === 'owner@gmail.com' || email === 'fauzan@gmail.com') {
    return true;
  }
  try {
    const userSnap = await db.collection('users').doc(email).get();
    if (userSnap.exists && userSnap.data()?.role === 'super admin') {
      return true;
    }
  } catch (err) {
    console.error('Error verifying admin status:', err);
  }
  return false;
}

/**
 * Generate a unique, readable member code: PE-XXXX-XXXX
 */
function generateMemberCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'PE-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3) code += '-';
  }
  return code;
}

// ============================================================================
// CLIENT FUNCTIONS (PS5 / Launcher)
// ============================================================================

/**
 * Claims a PS5 console for the signed-in account.
 * Enforces single-device login:
 * If no device or same device -> success.
 * If another device is already registered -> returns error 'other_device'.
 */
export const claimDevice = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = auth.uid;
  const { deviceId, name } = request.data || {};

  if (!deviceId || typeof deviceId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid deviceId.');
  }
  const cleanName = typeof name === 'string' && name.trim() ? name.trim() : 'PS5';

  const userRef = db.collection('users').doc(uid);
  const now = Date.now();

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      // First-time sign up / initialize profile
      const newAccount = {
        uid,
        email: auth.token.email || '',
        name: (auth.token.email?.split('@')[0] || 'Player').slice(0, 16),
        color: 0,
        membership: 'free',
        memberCode: '',
        requestedAt: 0,
        memberSince: 0,
        device: {
          id: deviceId,
          name: cleanName,
          since: now,
        },
        tried: [],
        trial_style: '',
        trial_ends: 0,
        trial: null,
        blocked: false,
        backups: 0,
        backupBytes: 0,
        lastBackup: 0,
        createdAt: now,
      };
      transaction.set(userRef, newAccount);
      return { success: true, claimed: true, device: { id: deviceId, name: cleanName } };
    }

    const data = userDoc.data()!;
    if (data.blocked) {
      throw new HttpsError('permission-denied', 'Account has been blocked by administrator.');
    }

    const currentDevice = data.device;
    if (!currentDevice || !currentDevice.id || currentDevice.id === deviceId) {
      // Free to claim or re-claiming same console
      transaction.update(userRef, {
        device: {
          id: deviceId,
          name: cleanName,
          since: now,
        },
      });
      return { success: true, claimed: true, device: { id: deviceId, name: cleanName } };
    }

    // Account is currently claimed by another PS5
    return {
      success: false,
      error: 'other_device',
      otherDevice: currentDevice.name || 'PS5 lain',
    };
  });
});

/**
 * Releases the claimed device upon PS5 sign out.
 */
export const releaseDevice = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = auth.uid;
  const userRef = db.collection('users').doc(uid);

  await userRef.update({ device: null });
  return { success: true };
});

/**
 * Requests Contribute membership: generates memberCode and sets status to 'pending'.
 */
export const requestContribute = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = auth.uid;
  const userRef = db.collection('users').doc(uid);
  const now = Date.now();
  const code = generateMemberCode();

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      const newAccount = {
        uid,
        email: auth.token.email || '',
        name: (auth.token.email?.split('@')[0] || 'Player').slice(0, 16),
        color: 0,
        membership: 'pending',
        memberCode: code,
        requestedAt: now,
        memberSince: 0,
        device: null,
        tried: [],
        trial_style: '',
        trial_ends: 0,
        trial: null,
        blocked: false,
        backups: 0,
        backupBytes: 0,
        lastBackup: 0,
        createdAt: now,
      };
      transaction.set(userRef, newAccount);
      return { success: true, memberCode: code, requestedAt: now };
    }

    const data = userDoc.data()!;
    if (data.membership === 'contribute') {
      return { success: true, alreadyMember: true, memberCode: data.memberCode || '' };
    }

    // Keep existing memberCode if already pending, otherwise use new one
    const activeCode = data.membership === 'pending' && data.memberCode ? data.memberCode : code;

    transaction.update(userRef, {
      membership: 'pending',
      memberCode: activeCode,
      requestedAt: now,
    });

    return { success: true, memberCode: activeCode, requestedAt: now };
  });
});

/**
 * Starts a 5-minute theme trial for a free account.
 * Guaranteed by server timestamp to prevent console clock manipulation.
 */
export const startTrial = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = auth.uid;
  const { style } = request.data || {};
  if (!style || typeof style !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid style key.');
  }

  const userRef = db.collection('users').doc(uid);
  const serverNowSeconds = Math.floor(Date.now() / 1000);

  return await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const data = userDoc.data()!;
    if (data.blocked) {
      throw new HttpsError('permission-denied', 'Account is blocked.');
    }

    if (data.membership === 'contribute') {
      return { success: true, isContribute: true };
    }

    const tried: string[] = Array.isArray(data.tried) ? data.tried : [];
    if (tried.includes(style)) {
      return { success: false, error: 'trial_used' };
    }

    const trialEnds = serverNowSeconds + 300; // 5 minutes
    tried.push(style);

    transaction.update(userRef, {
      tried,
      trial_style: style,
      trial_ends: trialEnds,
      trial: {
        style,
        endsAt: trialEnds * 1000,
      },
    });

    return {
      success: true,
      style,
      endsAt: trialEnds,
      serverTime: serverNowSeconds,
    };
  });
});

/**
 * Toggles a like on a Share screenshot post.
 */
export const likePost = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = auth.uid;
  const { postId, on } = request.data || {};
  if (!postId || typeof postId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid postId.');
  }

  const postRef = db.collection('posts').doc(postId);
  const likeRef = postRef.collection('likes').doc(uid);

  return await db.runTransaction(async (transaction) => {
    const postDoc = await transaction.get(postRef);
    if (!postDoc.exists) {
      throw new HttpsError('not-found', 'Post not found.');
    }

    const likeDoc = await transaction.get(likeRef);
    let currentLikes = postDoc.data()?.likes || 0;

    if (on) {
      if (!likeDoc.exists) {
        transaction.set(likeRef, { uid, at: Date.now() });
        currentLikes += 1;
        transaction.update(postRef, { likes: currentLikes });
      }
    } else {
      if (likeDoc.exists) {
        transaction.delete(likeRef);
        currentLikes = Math.max(0, currentLikes - 1);
        transaction.update(postRef, { likes: currentLikes });
      }
    }

    return { success: true, likes: currentLikes, liked: !!on };
  });
});

// ============================================================================
// SAVE DATA CLOUD: Report and update Save Data Storage per user
// ============================================================================

/**
 * Updates save metadata and aggregates total user backup storage in one atomic transaction.
 */
export const reportBackup = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = auth.uid;
  const { titleId, name, titleName, bytes, device } = request.data || {};

  if (!titleId || typeof bytes !== 'number') {
    throw new HttpsError('invalid-argument', 'Missing titleId or valid bytes number.');
  }

  const finalName = titleName || name || titleId;
  const userRef = db.collection('users').doc(uid);
  const saveRef = userRef.collection('saves').doc(titleId);
  const now = Date.now();

  await saveRef.set({
    titleId: String(titleId),
    titleName: String(finalName),
    name: String(finalName),
    bytes: Number(bytes),
    updatedAt: now,
    device: device || 'PS5',
  }, { merge: true });

  const savesSnap = await userRef.collection('saves').get();
  let totalBytes = 0;
  let count = savesSnap.size;
  let latestBackup = now;
  savesSnap.forEach((s) => {
    const data = s.data();
    totalBytes += Number(data.bytes) || 0;
    const upd = Number(data.updatedAt) || 0;
    if (upd > latestBackup) latestBackup = upd;
  });

  await userRef.set({
    backups: count,
    backupBytes: totalBytes,
    lastBackup: latestBackup,
  }, { merge: true });

  return { success: true, titleId, bytes, updatedAt: now, backups: count, backupBytes: totalBytes };
});

// ============================================================================
// ADMIN DASHBOARD FUNCTIONS
// ============================================================================

/**
 * Sets user membership ('contribute' or 'free').
 */
export const adminSetMembership = onCall(async (request) => {
  const isAdmin = await verifyAdmin(request.auth);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Unauthorized admin access.');
  }

  const { uid, membership } = request.data || {};
  if (!uid || !['free', 'pending', 'contribute'].includes(membership)) {
    throw new HttpsError('invalid-argument', 'Invalid uid or membership status.');
  }

  const userRef = db.collection('users').doc(uid);
  const now = Date.now();

  const updates: Record<string, any> = { membership };
  if (membership === 'contribute') {
    updates.memberSince = now;
  } else if (membership === 'free') {
    updates.memberSince = 0;
    updates.requestedAt = 0;
  }

  await userRef.update(updates);
  return { success: true, uid, membership };
});

/**
 * Forces release of a PS5 device login for a given user.
 */
export const adminReleaseDevice = onCall(async (request) => {
  const isAdmin = await verifyAdmin(request.auth);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Unauthorized admin access.');
  }

  const { uid } = request.data || {};
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Missing uid.');
  }

  await db.collection('users').doc(uid).update({ device: null });
  return { success: true, uid };
});

/**
 * Blocks or unblocks a user. Blocking also releases any active device and disables Firebase Auth.
 */
export const adminSetBlocked = onCall(async (request) => {
  const isAdmin = await verifyAdmin(request.auth);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Unauthorized admin access.');
  }

  const { uid, blocked } = request.data || {};
  if (!uid || typeof blocked !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Invalid uid or blocked boolean.');
  }

  const updates: Record<string, any> = { blocked };
  if (blocked) {
    updates.device = null;
  }

  await db.collection('users').doc(uid).update(updates);

  try {
    await admin.auth().updateUser(uid, { disabled: blocked });
  } catch (err) {
    console.warn(`Could not set Auth disabled for uid ${uid}:`, err);
  }

  return { success: true, uid, blocked };
});

/**
 * Deletes a post from Share and deletes its image in Cloud Storage.
 */
export const adminDeletePost = onCall(async (request) => {
  const isAdmin = await verifyAdmin(request.auth);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Unauthorized admin access.');
  }

  const { postId } = request.data || {};
  if (!postId) {
    throw new HttpsError('invalid-argument', 'Missing postId.');
  }

  const postRef = db.collection('posts').doc(postId);
  const postDoc = await postRef.get();

  if (postDoc.exists) {
    const postData = postDoc.data()!;
    const authorUid = postData.uid;

    // Delete likes subcollection
    const likes = await postRef.collection('likes').get();
    const batch = db.batch();
    likes.forEach((l) => batch.delete(l.ref));
    batch.delete(postRef);
    await batch.commit();

    // Delete image from Storage if exists
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(`share/${authorUid}/${postId}.jpg`);
      await file.delete({ ignoreNotFound: true });
    } catch (err) {
      console.warn(`Could not delete storage image for post ${postId}:`, err);
    }
  }

  return { success: true, postId };
});

/**
 * Retrieves all data for the Admin Dashboard (Accounts, Posts, Storage).
 */
export const adminGetDashboardData = onCall(async (request) => {
  const isAdmin = await verifyAdmin(request.auth);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Unauthorized admin access.');
  }

  // Fetch all users that have membership or are PE accounts
  const usersSnap = await db.collection('users').get();
  const users: any[] = [];

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    // Distinguish ProsperoEden accounts (they have membership or memberCode or UID id)
    if (data.membership || data.memberCode !== undefined || doc.id.length > 20) {
      // Fetch backups for this user
      const savesSnap = await doc.ref.collection('saves').get();
      const backups: any[] = [];
      savesSnap.forEach((s) => {
        const sd = s.data();
        backups.push({
          titleId: s.id,
          game: sd.name || s.id,
          bytes: Number(sd.bytes) || 0,
          updatedAt: Number(sd.updatedAt) || 0,
          device: sd.device || '',
        });
      });

      users.push({
        uid: doc.id,
        name: data.name || doc.id,
        email: data.email || '',
        color: Number(data.color) || 0,
        membership: data.membership || 'free',
        memberCode: data.memberCode || '',
        createdAt: Number(data.createdAt) || 0,
        requestedAt: Number(data.requestedAt) || 0,
        memberSince: Number(data.memberSince) || 0,
        device: data.device || null,
        tried: Array.isArray(data.tried) ? data.tried : [],
        blocked: !!data.blocked,
        backups,
      });
    }
  }

  // Fetch posts
  const postsSnap = await db.collection('posts').orderBy('createdAt', 'desc').limit(100).get();
  const posts: any[] = [];
  postsSnap.forEach((doc) => {
    const pd = doc.data();
    posts.push({
      id: doc.id,
      uid: pd.uid,
      game: pd.game || '',
      caption: pd.caption || '',
      likes: Number(pd.likes) || 0,
      at: Number(pd.createdAt) || 0,
      imageUrl: pd.imageUrl || '',
    });
  });

  return { users, posts };
});
