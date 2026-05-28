declare global {
  const google: any;
}

const CLIENT_ID = '768114767362-millah4ncclu4cmliqosi1qqhncea5pd.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any;
let gisInited = false;
let initPromise: Promise<boolean> | null = null;
let currentAccessToken: string | null = null;

export const initGoogleDrive = (): Promise<boolean> => {
  if (gisInited) return Promise.resolve(true);

  if (!initPromise) {
    initPromise = new Promise((resolve, reject) => {
      // Load GIS (Identity)
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.onload = () => {
        tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: '', 
        });
        gisInited = true;
        resolve(true);
      };
      gisScript.onerror = () => reject(new Error("Gagal load GIS"));
      document.body.appendChild(gisScript);
    });
  }
  return initPromise;
};

export const authenticateDrive = async (): Promise<string> => {
    await initGoogleDrive();
    return new Promise((resolve, reject) => {
        if (currentAccessToken) {
            resolve(currentAccessToken);
            return;
        }

        tokenClient.callback = async (resp: any) => {
            if (resp.error !== undefined) {
                reject(new Error(resp.error));
            }
            currentAccessToken = resp.access_token;
            resolve(resp.access_token);
        };
        
        tokenClient.requestAccessToken({prompt: 'consent'});
    });
};

export const isDriveAuthenticated = (): boolean => {
    return currentAccessToken !== null;
};

export const logoutDrive = () => {
    if (currentAccessToken !== null) {
        (window as any).google.accounts.oauth2.revoke(currentAccessToken, () => {
             currentAccessToken = null;
        });
    }
};

export const uploadBackupToDrive = async (jsonDataString: string): Promise<string> => {
    await initGoogleDrive();
    await authenticateDrive();
    
    // Cari file apakah sudah pernah dibuat
    let fileId: string | null = null;
    const qResp = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='urban_console_backup.json' and trashed=false&spaces=drive`, {
        headers: new Headers({ 'Authorization': 'Bearer ' + currentAccessToken }),
    });
    const searchResp = await qResp.json();
    
    if (searchResp.files && searchResp.files.length > 0) {
        fileId = searchResp.files[0].id;
    }

    const fileMetadata = {
        name: 'urban_console_backup.json',
        mimeType: 'application/json'
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    form.append('file', new Blob([jsonDataString], { type: 'application/json' }));
    
    const tokenOptions = {
        method: fileId ? 'PATCH' : 'POST',
        headers: new Headers({ 'Authorization': 'Bearer ' + currentAccessToken }),
        body: form
    };

    const url = fileId 
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const fetchResult = await fetch(url, tokenOptions);
    if (!fetchResult.ok) {
        throw new Error("Gagal komunikasi dengan server Google Drive");
    }
    const json = await fetchResult.json();
    return json.id; 
};

export const downloadBackupFromDrive = async (): Promise<string> => {
    await initGoogleDrive();
    await authenticateDrive();

    const qResp = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='urban_console_backup.json' and trashed=false&spaces=drive`, {
        headers: new Headers({ 'Authorization': 'Bearer ' + currentAccessToken }),
    });
    const searchResp = await qResp.json();

    if (!searchResp.files || searchResp.files.length === 0) {
        throw new Error("File backup 'urban_console_backup.json' belum ada di Google Drive. Silakan buat backup pertama kali.");
    }

    const fileId = searchResp.files[0].id;
    const tokenOptions = {
        method: 'GET',
        headers: new Headers({ 'Authorization': 'Bearer ' + currentAccessToken }),
    };

    const fetchResult = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, tokenOptions);
    if (!fetchResult.ok) {
        throw new Error("Gagal mengunduh file backup dari Google Drive");
    }
    
    return await fetchResult.text();
};
