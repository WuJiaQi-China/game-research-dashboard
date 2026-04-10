export const SOURCE_COLORS: Record<string, string> = {
  'itch.io': '#FA5C5C',
  'vndb.org': '#4A90D9',
  'dlsite.com': '#F5A623',
  'erogames.to': '#7B68EE',
  'nutaku.net': '#2ECC71',
  'steam': '#1B2838',
  'gamejolt.com': '#CCFF00',
  'lemmasoft.renai.us': '#FF6B9D',
  'hanakogames.com': '#FFB6C1',
  'otomeobsessed.com': '#9B59B6',
  'wattpad.com': '#FF6122',
  'webtoons.com': '#00D564',
  'mangadex.org': '#FF6740',
  'archiveofourown.org': '#990000',
  'dreame.com': '#8B5CF6',
  'jjwxc.net': '#E91E63',
  'pixiv.net': '#0096FA',
  'artstation.com': '#13AFF0',
  'yande.re': '#FF6B9D',
};

export const TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  game: { zh: '🎮 游戏', en: '🎮 Game' },
  novel: { zh: '📖 小说', en: '📖 Novel' },
  comic: { zh: '📚 漫画', en: '📚 Comic' },
  artist: { zh: '🎨 画师', en: '🎨 Artist' },
};

export const GAME_SOURCES = ['vndb', 'itchio', 'erogames', 'steam', 'dlsite', 'nutaku', 'gamejolt', 'lemmasoft', 'hanako', 'otome_obsessed'];
export const NOVEL_SOURCES = ['wattpad', 'ao3', 'dreame', 'jjwxc'];
export const COMIC_SOURCES = ['webtoons', 'mangadex'];
export const ARTIST_SOURCES = ['pixiv', 'artstation', 'yandere'];

export const ALL_SOURCES = [...GAME_SOURCES, ...NOVEL_SOURCES, ...COMIC_SOURCES, ...ARTIST_SOURCES];

export const SOURCE_LABELS: Record<string, string> = {
  vndb: 'VNDB', itchio: 'itch.io', erogames: 'erogames', steam: 'Steam',
  dlsite: 'DLsite', nutaku: 'Nutaku', gamejolt: 'GameJolt', lemmasoft: 'Lemmasoft',
  hanako: 'Hanako', otome_obsessed: 'OtomeObs',
  wattpad: 'Wattpad', ao3: 'AO3', dreame: 'Dreame', jjwxc: 'JJWXC',
  webtoons: 'Webtoons', mangadex: 'MangaDex',
  pixiv: 'Pixiv', artstation: 'ArtStation', yandere: 'Yande.re',
};

export const DEFAULT_DLSITE_CATEGORIES = [
  { label: 'women-EN', url: 'https://www.dlsite.com/ecchi-eng/fsr/=/language/ENG/sex_category%5B0%5D/female/order%5B0%5D/rate_total_average_point/per_page/30' },
  { label: 'otome-JP', url: 'https://www.dlsite.com/girls/fsr/=/language/JPN/order%5B0%5D/rate_total_average_point/per_page/30' },
];

export const VERTEX_LOCATIONS = [
  'us-central1', 'us-east4', 'us-west1', 'us-west4',
  'europe-west1', 'europe-west4', 'asia-northeast1',
  'asia-southeast1', 'asia-east1',
];
