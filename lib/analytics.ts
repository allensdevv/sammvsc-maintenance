export interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl: string;
  followers: number;
  following: number;
  posts: number;
  isPrivate: boolean;
  isVerified: boolean;
}

// ---------- Follower Quality ----------

export interface FollowerQualityResult {
  realRate: number;       // 0-100
  suspiciousRate: number;
  passiveRate: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export function calcFollowerQuality(p: InstagramProfile): FollowerQualityResult {
  const { followers, following, posts, isVerified } = p;

  const ratio = following > 0 ? followers / following : followers > 0 ? 10 : 1;

  // Suspicious: high when following > followers or many followers but few posts
  let suspicious = 0;
  if (ratio < 0.5) suspicious += 30;
  else if (ratio < 1) suspicious += 18;
  else if (ratio < 2) suspicious += 8;

  if (followers > 10000 && posts < 20) suspicious += 15;
  if (followers > 100000 && posts < 50) suspicious += 10;
  if (following > 5000) suspicious += 8;
  if (isVerified) suspicious = Math.max(0, suspicious - 10);

  suspicious = Math.min(suspicious, 55);

  // Passive: scales with account size
  let passive = 0;
  if (followers >= 1_000_000) passive = 38;
  else if (followers >= 100_000) passive = 30;
  else if (followers >= 10_000) passive = 20;
  else if (followers >= 1_000) passive = 12;
  else passive = 6;

  passive = Math.min(passive, 45);

  const real = Math.max(0, 100 - suspicious - passive);

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (real >= 80) grade = 'A';
  else if (real >= 65) grade = 'B';
  else if (real >= 50) grade = 'C';
  else if (real >= 35) grade = 'D';
  else grade = 'F';

  return { realRate: real, suspiciousRate: suspicious, passiveRate: passive, grade };
}

// ---------- Viral Score ----------

export interface ViralScoreResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  components: {
    followRatio: number;
    contentActivity: number;
    accountAuthority: number;
    engagementPotential: number;
  };
}

export function calcViralScore(p: InstagramProfile): ViralScoreResult {
  const { followers, following, posts, isVerified, isPrivate } = p;

  // Follow ratio (0-30 pts) — log scale
  const ratio = following > 0 ? followers / following : (followers > 0 ? 10 : 0);
  const logRatio = Math.log10(Math.max(ratio, 0.01) + 1);
  const followRatio = Math.min(30, Math.round(logRatio * 22));

  // Content activity (0-25 pts)
  const postsPerFollower = followers > 0 ? posts / followers : 0;
  let contentActivity: number;
  if (posts === 0) contentActivity = 0;
  else if (posts >= 200) contentActivity = 25;
  else if (posts >= 100) contentActivity = 20;
  else if (posts >= 50) contentActivity = 15;
  else if (posts >= 20) contentActivity = 10;
  else contentActivity = 5;
  if (postsPerFollower > 0.01) contentActivity = Math.min(25, contentActivity + 3);

  // Account authority (0-25 pts)
  let accountAuthority = 0;
  if (followers >= 1_000_000) accountAuthority = 25;
  else if (followers >= 100_000) accountAuthority = 20;
  else if (followers >= 10_000) accountAuthority = 14;
  else if (followers >= 1_000) accountAuthority = 8;
  else accountAuthority = 3;
  if (isVerified) accountAuthority = Math.min(25, accountAuthority + 5);

  // Engagement potential (0-20 pts)
  let engagementPotential = 10;
  if (isPrivate) engagementPotential += 6;
  if (isVerified) engagementPotential += 4;
  if (ratio > 5) engagementPotential += 3;
  engagementPotential = Math.min(20, engagementPotential);

  const score = Math.min(100, followRatio + contentActivity + accountAuthority + engagementPotential);
  const level: 'low' | 'medium' | 'high' = score >= 65 ? 'high' : score >= 40 ? 'medium' : 'low';

  return { score, level, components: { followRatio, contentActivity, accountAuthority, engagementPotential } };
}

// ---------- Reels Estimate ----------

export interface ReelsEstimateResult {
  avgViews: number;
  reachRate: number;    // %
  viralPotential: number; // 0-100
  bestHours: number[];
}

export function calcReelsEstimate(p: InstagramProfile): ReelsEstimateResult {
  const { followers, isVerified, isPrivate } = p;

  let reachRate: number;
  if (followers < 1_000) reachRate = 25;
  else if (followers < 10_000) reachRate = 15;
  else if (followers < 100_000) reachRate = 8;
  else if (followers < 1_000_000) reachRate = 5;
  else reachRate = 3;

  let multiplier = 1;
  if (isVerified) multiplier *= 1.2;
  if (isPrivate) multiplier *= 1.3;

  const avgViews = Math.round(followers * (reachRate / 100) * multiplier);

  let viralPotential = 0;
  if (followers < 1_000) viralPotential = 30;
  else if (followers < 10_000) viralPotential = 45;
  else if (followers < 100_000) viralPotential = 60;
  else if (followers < 1_000_000) viralPotential = 70;
  else viralPotential = 80;
  if (isVerified) viralPotential = Math.min(100, viralPotential + 10);
  if (isPrivate) viralPotential = Math.max(0, viralPotential - 10);

  return {
    avgViews,
    reachRate,
    viralPotential,
    bestHours: [9, 12, 18, 21],
  };
}

// ---------- Engagement Rate ----------

export function calcEngagementRate(p: InstagramProfile): number {
  const { followers, isPrivate, isVerified, following } = p;
  const ratio = following > 0 ? followers / following : 1;

  let rate: number;
  if (followers < 1_000) rate = 8;
  else if (followers < 10_000) rate = 5;
  else if (followers < 100_000) rate = 3;
  else if (followers < 1_000_000) rate = 1.5;
  else rate = 0.8;

  if (isPrivate) rate *= 1.5;
  if (isVerified) rate *= 1.2;
  if (ratio < 0.5) rate *= 0.7;

  return Math.round(rate * 100) / 100;
}

// ---------- AI Insight ----------

export interface AIInsightResult {
  headline: string;
  body: string;
  tags: string[];
  sentiment: 'positive' | 'neutral' | 'warning';
}

export function generateAIInsight(p: InstagramProfile): AIInsightResult {
  const { followers, following, posts, isVerified, isPrivate } = p;
  const engRate = calcEngagementRate(p);
  const quality = calcFollowerQuality(p);
  const viral = calcViralScore(p);
  const ratio = following > 0 ? followers / following : (followers > 0 ? 10 : 0);

  let tier: string;
  if (followers >= 1_000_000) tier = 'mega influencer';
  else if (followers >= 100_000) tier = 'makro influencer';
  else if (followers >= 10_000) tier = 'mikro influencer';
  else if (followers >= 1_000) tier = 'nano influencer';
  else tier = 'yeni hesap';

  const ratioQuality = ratio >= 5 ? 'mükemmel' : ratio >= 2 ? 'iyi' : ratio >= 1 ? 'ortalama' : 'düşük';

  // Build headline
  let headline = '';
  let sentiment: 'positive' | 'neutral' | 'warning' = 'neutral';

  if (quality.grade === 'A' && viral.level === 'high') {
    headline = `Güçlü ve Organik ${tier.charAt(0).toUpperCase() + tier.slice(1)} Profili`;
    sentiment = 'positive';
  } else if (quality.grade === 'F' || viral.level === 'low') {
    headline = `Geliştirme Gerektiren ${tier.charAt(0).toUpperCase() + tier.slice(1)} Hesabı`;
    sentiment = 'warning';
  } else {
    headline = `Potansiyel Taşıyan ${tier.charAt(0).toUpperCase() + tier.slice(1)} Profili`;
    sentiment = 'neutral';
  }

  // Build body
  const parts: string[] = [];
  parts.push(`Bu hesap ${formatNumber(followers)} takipçisiyle ${tier} kategorisinde değerlendiriliyor.`);

  parts.push(
    `Takipçi/Takip oranı ${ratioQuality} seviyede (${ratio >= 1 ? ratio.toFixed(1) : '0.' + Math.round(ratio * 10)}x), ` +
    `takipçi kalitesi ise tahmini olarak %${quality.realRate} gerçek kullanıcıdan oluşuyor (${quality.grade} notu).`
  );

  if (isVerified) {
    parts.push('Hesap doğrulanmış olması sayesinde organik erişim ve güvenilirlik avantajı elde ediyor.');
  }
  if (isPrivate) {
    parts.push('Özel hesap yapısı takipçi bağlılığını artırırken daha geniş kitlelere ulaşmayı kısıtlıyor.');
  }

  parts.push(`Tahmini etkileşim oranı %${engRate} olarak hesaplandı; ${posts} gönderi ile içerik yoğunluğu ${posts >= 50 ? 'güçlü' : 'geliştirilmeli'} görünüyor.`);

  // Tags
  const tags: string[] = [tier];
  if (isVerified) tags.push('Doğrulanmış');
  if (isPrivate) tags.push('Özel Hesap');
  if (quality.grade === 'A' || quality.grade === 'B') tags.push('Kaliteli Takipçi');
  if (viral.level === 'high') tags.push('Viral Potansiyel');
  if (engRate >= 3) tags.push(`%${engRate} Etkileşim`);

  return {
    headline,
    body: parts.join(' '),
    tags,
    sentiment,
  };
}

// ---------- Utilities ----------

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'B';
  return String(n);
}
