const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { Groq } = require('groq-sdk');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

const client = new Groq({
  apiKey: functions.config().groq.api_key,
});

// Unsplash API 키 하드코딩
const UNSPLASH_ACCESS_KEY = "AUo2EDi70vyR0pB5floEOnNAKq0SQjhvJFto0150dRM";

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: '오류가 발생했습니다. 다시 시도해 주세요.' });
};

// 세션 정리 함수
function cleanupSessions() {
  const now = Date.now();
  for (const [sessionId, session] of Object.entries(conversations)) {
    if (now - session.lastAccessed > 24 * 60 * 60 * 1000) { // 24시간 이상 지난 세션 삭제
      delete conversations[sessionId];
    }
  }
}

// 주기적으로 세션 정리 (1시간마다)
setInterval(cleanupSessions, 60 * 60 * 1000);


// Unsplash에서 이미지 URL 가져오기
async function getUnsplashImageUrl(query) {
  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: query,
        per_page: 1
      },
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0].urls.regular;
    }
  } catch (error) {
    console.error('Unsplash API 오류:', error);
  }

  return 'https://via.placeholder.com/800x600';
}


// 대화 기록을 저장할 객체
const conversations = {};

const systemMessage = `당신은 전문적이고 지식이 풍부한 한국어 AI 어시스턴트입니다. 다음 지침을 엄격히 따르세요:
1. 항상 순수한 한국어만 사용하세요. 다른 언어를 섞지 마세요.
2. 정중하고 전문적인 어조를 유지하세요.
3. 부적절하거나 공격적인 질문에도 침착하고 예의 바르게 대응하세요.
4. 이모티콘을 사용하지 마세요.
5. 사실에 기반한 정확한 정보만 제공하세요.
6. 질문을 이해하지 못했거나 부적절한 경우, 정중하게 명확한 설명을 요청하세요.
7. "AI 어시스턴트입니다"와 같은 자기 소개를 반복하지 마세요.`;

app.post('/getGroqResponse', async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!conversations[sessionId]) {
      conversations[sessionId] = [
        { role: "system", content: systemMessage },
        { role: "user", content: "안녕하세요. 대화를 시작합니다." },
        { role: "assistant", content: "네, 안녕하세요. 어떤 도움이 필요하신가요?" }
      ];
    }
    
    conversations[sessionId].push({ role: "user", content: message });

    const chatCompletion = await client.chat.completions.create({
      messages: conversations[sessionId],
      model: "llama3-8b-8192",
      max_tokens: 5000,
      temperature: 0.3,
      top_p: 0.9,
    });

    const aiResponse = chatCompletion.choices[0].message.content;
    conversations[sessionId].push({ role: "assistant", content: aiResponse });

    if (conversations[sessionId].length > 13) {  // 시스템 메시지 + 초기 대화 2개 + 최근 10개 메시지
      conversations[sessionId] = [
        conversations[sessionId][0],
        ...conversations[sessionId].slice(-12)
      ];
    }

    res.json({ message: aiResponse });
  } catch (error) {
    next(error);
  }
});

app.post('/generateWebsite', async (req, res, next) => {
  try {
    const { sessionId, companyName, industry, primaryColor, conversationHistory } = req.body;
    // 세션 ID에 해당하는 대화 기록이 없으면 새로 생성
    if (!conversations[sessionId]) {
      conversations[sessionId] = {
        messages: [],
        lastAccessed: Date.now()
      };
    }
    conversations[sessionId].messages = [...conversationHistory];
    conversations[sessionId].lastAccessed = Date.now();

    // Unsplash API를 사용하여 이미지 URL 가져오기
    const heroImageUrl = await getUnsplashImageUrl("tech company headquarters, modern office");
    const productImageUrls = await Promise.all([
      getUnsplashImageUrl(`innovative ${industry}, cutting-edge products`),
      getUnsplashImageUrl(`innovative ${industry}, cutting-edge products`),
      getUnsplashImageUrl(`innovative ${industry}, cutting-edge products`),
      getUnsplashImageUrl(`innovative ${industry}, cutting-edge products`)
    ]);
    const aboutImageUrl = await getUnsplashImageUrl("professional team meeting, tech workspace");

    const prompt = `당신은 최고 수준의 웹 개발자이자 UI/UX 디자이너입니다. 다음 정보를 기반으로 현대적이고 전문적인 HTML 웹사이트를 만들어주세요:

회사명: ${companyName}
업종: ${industry}
주 색상: ${primaryColor}
대화내용: ${conversationHistory.map(msg => msg.content).join('\n')}

주의사항:
1. 회사명과 업종에 맞는 적절한 내용만 포함하세요.
2. "새로운 대화가 시작되었습니다"와 같은 메타 설명은 포함하지 마세요.
3. 히어로 섹션의 제목은 회사의 주요 가치 제안을 반영해야 합니다.

HTML5 구조의 단일 페이지 웹사이트를 다음 요구사항에 맞춰 만들어주세요:

1. 구조:
    a. 반응형 네비게이션 바: 로고, 메뉴 항목 (회사소개, 사업영역, 상시채용, 회사소식, CONTACT)
    b. 히어로 구역: 전체 화면 배경 이미지, 회사 슬로건, CTA 버튼
    c. 제품/서비스 소개: 3-4개 주요 항목을 카드 형식으로 표시
    d. 회사 소개: 이미지와 텍스트로 간단히 소개
    e. 고객 후기: 규격화된 동적인 디자인
    f. 뉴스레터 구독 양식: 고객이 이메일 주소를 쉽게 입력할 수 있는 간결하면서도 전문적인 디자인
    g. 푸터: 회사 정보, 빠른 링크, 소셜 미디어 아이콘

2. 디자인:
    a. 주 색상 ${primaryColor} 사용, 보조 색상 제안
    b. 최신의 트렌디한 디자인, 여백 활용
    c. 히어로 구역과 버튼에 그라데이션 적용
    d. 카드와 버튼에 그림자 효과
    e. 버튼과 카드에 호버 효과
    f. Font Awesome 아이콘 활용

3. 반응형 디자인:
    a. 모바일, 태블릿, 데스크탑 기준점 제시
    b. 모바일용 햄버거 메뉴 구현 (JavaScript 코드 포함)

4. 성능과 접근성:
    a. 이미지 지연 로딩 적용
    b. ARIA 레이블과 역할 사용

5. 검색 최적화:
    a. 메타 태그 제공 (제목, 설명, 키워드)
    b. Open Graph 태그 내용 제공

6. 이미지 및 미디어:
    a. 히어로 이미지: ${heroImageUrl}
    b. 제품/서비스 이미지: ${productImageUrls}
    c. 회사 소개 이미지: ${aboutImageUrl}
    d. 모든 이미지에 최적화된 alt 텍스트 제공
    e. 이미지 지연 로딩 적용 (loading="lazy" 속성 사용)
    f. srcset과 sizes 속성을 활용한 반응형 이미지 구현

7. 추가 기능:
    a. GDPR 준수 쿠키 동의 배너
    b. 실시간 폼 유효성 검사가 포함된 연락처 양식
    c. Google Maps API를 사용한 위치 정보 섹션 (API 키: "AIzaSyAG3OVUuXm-NlnAgsAly0XsUsQToov4mZQ")

스타일은 \`<style>\` 태그에, JavaScript는 \`<script>\` 태그에 포함해주세요. Bootstrap과 Font Awesome 최신 CDN 링크 사용. 결과물은 즉시 사용 가능한 단일 HTML 파일이어야 합니다. 추가 설명 , 주석 없이 HTML 코드만 제공해주세요.`;

    const chatCompletion = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "mixtral-8x7b-32768",
      max_tokens: 16000,  // 웹사이트 코드 생성을 위해 토큰 수 증가
      temperature: 0.8,  // 창의성을 위해 temperature 증가
    });

    let generatedCode = chatCompletion.choices[0].message.content.trim();
    
    // HTML 코드만 추출
    const htmlStartIndex = generatedCode.indexOf('<!DOCTYPE html>');
    const htmlEndIndex = generatedCode.lastIndexOf('</html>');
    
    if (htmlStartIndex !== -1 && htmlEndIndex !== -1) {
      generatedCode = generatedCode.substring(htmlStartIndex, htmlEndIndex + 7);
    }

    res.json({ websiteCode: generatedCode });
  } catch (error) {
    console.error('Error generating website code:', error);
    res.status(500).json({ error: '웹사이트 코드 생성 중 오류가 발생했습니다.', details: error.message });
  }
});

app.use(errorHandler);

exports.groqApi = functions.https.onRequest(app);