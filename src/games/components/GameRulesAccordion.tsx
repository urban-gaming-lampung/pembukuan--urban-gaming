import React, { useState } from 'react';
import { ChevronDown, BookOpen, Shield, HelpCircle } from 'lucide-react';
import { GameType } from '../types';
import { GAME_NAMES_ID, MAX_SCORE_CAP, MAX_ATTEMPTS_PER_DAY } from '../constants';

interface GameRulesAccordionProps {
  gameType: GameType;
}

/**
 * GameRulesAccordion renders a collapsible card explaining the game rules,
 * daily attempt limits, score caps, and anti-cheat policies.
 */
export default function GameRulesAccordion({ gameType }: GameRulesAccordionProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const maxScore = MAX_SCORE_CAP[gameType] || 9999;

  const getGameSpecificRules = (type: GameType): string[] => {
    switch (type) {
      case 'snake':
        return [
          'Kendalikan ular menggunakan tombol arah (Arrow keys) atau kontrol layar.',
          'Makan apel merah untuk memanjangkan ekor ular dan mendapat skor.',
          'Permainan berakhir apabila kepala ular menabrak batas dinding atau menabrak ekornya sendiri.',
        ];
      case 'breaker':
        return [
          'Geser papan pemantul ke kanan/kiri untuk menahan bola agar tidak jatuh.',
          'Hancurkan semua susunan balok warna-warni di atas layar.',
          'Kumpulkan item power-up seperti perluasan papan untuk mempermudah kemenangan.',
        ];
      case 'invaders':
        return [
          'Kendalikan kapal luar angkasa Anda untuk menembak mundur armada alien.',
          'Hindari hujanan laser alien dan lindungi benteng pertahanan Anda.',
          'Dapatkan skor lebih tinggi dengan menjatuhkan kapal induk alien di baris atas.',
        ];
      case 'stack':
        return [
          'Ketuk layar untuk meletakkan potongan balok tepat di atas tumpukan.',
          'Setiap ketukan yang tidak presisi akan memangkas ukuran lebar balok Anda.',
          'Tumpuk balok setinggi mungkin hingga balok menjadi terlalu kecil dan jatuh.',
        ];
      case 'runner':
        return [
          'Ketuk tombol lompat untuk menghindari rintangan dan celah berbahaya.',
          'Kecepatan rintangan akan meningkat secara eksponensial seiring bertambahnya jarak.',
          'Kumpulkan koin emas di sepanjang jalan untuk meningkatkan akumulasi skor.',
        ];
      case 'striker':
        return [
          'Kendalikan pesawat tempur P-38 menggunakan D-Pad arah atau geser layar ponsel Anda.',
          'Tekan tombol [A] untuk menembak peluru, dan tekan [B] untuk melakukan manuver loop-the-loop agar kebal sementara.',
          'Hancurkan formasi musuh, kumpulkan item POW, dan kalahkan kapal induk Boss di setiap stage.',
        ];
      default:
        return [];
    }
  };

  const specificRules = getGameSpecificRules(gameType);

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800/80 dark:bg-zinc-900/30 overflow-hidden transition-all duration-200 font-sans">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left font-semibold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/20 transition-colors focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-4 w-4 text-emerald-500" />
          <span>Aturan Main & Batasan</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50 text-[12px] text-zinc-600 dark:text-zinc-400 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Section: Cara Bermain */}
          <div className="space-y-2">
            <h5 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
              Cara Bermain:
            </h5>
            <ul className="list-disc pl-5 space-y-1.5 text-left leading-relaxed">
              {specificRules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
              <li>
                Skor maksimum per sesi untuk game ini adalah{' '}
                <strong className="text-zinc-800 dark:text-zinc-200">
                  {maxScore.toLocaleString('id-ID')} poin
                </strong>.
              </li>
            </ul>
          </div>

          {/* Section: Anti Cheat & Daily limits */}
          <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2">
            <h5 className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Sistem Keamanan & Limit:
            </h5>
            <ul className="list-disc pl-4 space-y-1.5 text-left text-amber-800 dark:text-amber-300 leading-relaxed">
              <li>
                Maksimal percobaan bermain: <strong>{MAX_ATTEMPTS_PER_DAY} kali per hari</strong>.
              </li>
              <li>
                Setiap akhir permainan diverifikasi secara otomatis oleh sistem keamanan anti-cheat.
                Manipulasi skor atau aktivitas ilegal akan diblokir dari klasemen.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
