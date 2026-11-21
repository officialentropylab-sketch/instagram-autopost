// "댓글에 '입시' 남기면 자료를 보내 드린다"는 안내 문구를 config.json의 cta 설정으로 만든다.
// 카드 이미지(표지·마무리)와 캡션이 같은 문구를 쓰도록 한곳에서 만든다.

// 받침이 있으면 "을", 없으면 "를"
function objectParticle(word) {
  const last = String(word).trim().at(-1) ?? "";
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? "를" : "을";
  return "를";
}

/** cta 설정이 꺼져 있거나 없으면 null */
export function ctaTexts(cta) {
  if (!cta?.enabled || !cta.keyword || !cta.offer) return null;
  const kw = cta.keyword;
  const offer = cta.offer;
  return {
    coverBadge: `💬 댓글에 '${kw}' 남기면 ${offer}`,
    outroLine1: `💬 댓글에 '${kw}'${objectParticle(kw)} 남겨 주세요`,
    outroLine2: `${offer}${objectParticle(offer)} DM으로 보내드려요`,
    captionTop: `📌 댓글에 '${kw}'${objectParticle(kw)} 남겨 주시면 ${offer}${objectParticle(offer)} DM으로 보내드려요!`,
    captionEnd: `💬 '${kw}' 댓글 남기고 ${offer} 받아 가세요!`,
  };
}
