const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { Groq } = require('groq-sdk');
const axios = require('axios');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

const client = new Groq({
  apiKey: functions.config().groq.api_key,
});

// Unsplash API 키
const UNSPLASH_ACCESS_KEY = "AUo2EDi70vyR0pB5floEOnNAKq0SQjhvJFto0150dRM";

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: '오류가 발생했습니다. 다시 시도해 주세요.', details: err.message });
};

// 대화 기록을 저장할 객체
const conversations = {};

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
  console.log(`Unsplash에서 "${query}" 이미지를 찾지 못했습니다. Placeholder 사용.`);
  return `https://via.placeholder.com/800x600?text=${encodeURIComponent(query)}`;
}

const systemMessage = `당신은 한국인 웹 개발 어시스턴트입니다. 다음 지침을 엄격히 따르세요:
                          1. 항상 순수한 한국어로 답변하세요
                          2. 정중하고 전문적인 어조를 유지하세요.
                          3. 웹 개발과 관련된 질문에 상세하고 정확한 답변을 제공하세요.
                          4. 최신 웹 개발 트렌드와 모범 사례를 반영하세요.
                          5. 코드 예시를 제공할 때는 명확하고 잘 주석 처리된 코드를 작성하세요.
                          6. 웹 접근성, 성능 최적화, 반응형 디자인 등 중요한 웹 개발 원칙을 강조하세요.
                          7. 질문을 이해하지 못했거나 부적절한 경우, 정중하게 명확한 설명을 요청하세요.`;

app.post('/getGroqResponse', async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!conversations[sessionId]) {
      conversations[sessionId] = [
        { role: "system", content: systemMessage },
        { role: "user", content: "안녕하세요. 웹 개발에 대한 대화를 시작합니다." },
        { role: "assistant", content: "네, 안녕하세요. 웹 개발에 관해 어떤 도움이 필요하신가요? 특정 주제나 기술에 대해 궁금하신 점이 있으시면 말씀해 주세요." }
      ];
    }
    
    conversations[sessionId].push({ role: "user", content: message });

    const chatCompletion = await client.chat.completions.create({
      messages: conversations[sessionId],
      model: "llama3-8b-8192",
      max_tokens: 8000,
      temperature: 0.7,
      top_p: 0.95,
    });

    const aiResponse = chatCompletion.choices[0].message.content;
    conversations[sessionId].push({ role: "assistant", content: aiResponse });

    if (conversations[sessionId].length > 15) {  // 시스템 메시지 + 초기 대화 2개 + 최근 12개 메시지
      conversations[sessionId] = [
        conversations[sessionId][0],
        ...conversations[sessionId].slice(-14)
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
    
    if (!conversations[sessionId]) {
      conversations[sessionId] = {
        messages: [],
        lastAccessed: Date.now()
      };
    }
    conversations[sessionId].messages = [...conversationHistory];
    conversations[sessionId].lastAccessed = Date.now();

      // Unsplash API를 사용하여 이미지 URL 가져오기
      const heroImageUrl = await getUnsplashImageUrl("modern tech office, wide angle");
      const productImageUrls = await Promise.all([
        getUnsplashImageUrl(`${industry} product, minimalist`),
        getUnsplashImageUrl(`${industry} service, modern`),
        getUnsplashImageUrl(`${industry} technology, futuristic`)
      ]);
      const teamImageUrl = await getUnsplashImageUrl("diverse professional team, office setting");
      const guestImageUrl = await getUnsplashImageUrl("diverse professional team, office setting");
      const aboutImageUrl = await getUnsplashImageUrl("innovative workspace, tech company");


      const baseTemplate = `
       <!DOCTYPE html>
       <html lang="ko">
       <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <meta name="description" content="${companyName}는 ${industry} 전문 업체입니다.">
         <meta name="keywords" content="${industry}, 전문, 업체">
         <meta name="author" content="${companyName}">
         <title>${companyName} | ${industry} Specialists</title>
         <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css">
         <script src="https://cdn.jsdelivr.net/gh/alpinejs/alpine@v2.x.x/dist/alpine.min.js" defer></script>
         <style>
           /* Custom styles will be inserted here */
         </style>
       </head>
       <body>
         <!-- Navigation -->
         <nav>
           <!-- Navigation content will be inserted here -->
         </nav>
       
         <!-- Hero section -->
         <header>
           <!-- Hero content will be inserted here -->
         </header>
       
         <!-- Main content -->
         <main>
           <!-- Main content sections will be inserted here -->
         </main>
       
         <!-- Footer -->
         <footer>
           <!-- Footer content will be inserted here -->
         </footer>
       
         <script>
           // Custom scripts will be inserted here
         </script>
       </body>
       </html>`;   
    
    const initialPrompt = `전문 한극인 웹 개발자로서, 다음 요구사항에 맞는 현대적이고 전문적인 단일 페이지 웹사이트를 위한 HTML, CSS, JavaScript 코드를 생성해주세요:

    회사명: ${companyName}
    업종: ${industry}
    주 색상: ${primaryColor}

    다음 템플릿을 기반으로 각 섹션의 내용을 채워주세요:

    ${baseTemplate}

    요구사항:
    1. 반응형 디자인 (모바일, 태블릿, 데스크톱)
    2. 모던하고 깔끔한 UI/UX
    3. 성능 최적화 (이미지 지연 로딩, 최소화된 CSS/JS)
    4. 접근성 고려 (ARIA 레이블, 키보드 네비게이션)
    5. SEO 최적화 (메타 태그, 시맨틱 HTML)
    6. 애니메이션과 트랜지션 효과
    7. 폼 유효성 검사
    8. 쿠키 동의 배너
    9. 소셜 미디어 통합

    다음 섹션을 포함해야 합니다:
    - 네비게이션 바
    - 히어로 섹션 (배경 이미지: ${heroImageUrl})
    - 회사 소개 (이미지: ${aboutImageUrl})
    - 서비스/제품 소개 (이미지: ${productImageUrls.join(', ')})
    - 팀 소개 (이미지: ${teamImageUrl})
    - 고객 후기 (이미지: ${guestImageUrl})
    - 연락처 폼
    - 푸터

    주의사항:
    - 모든 내용은 한국어로 작성되어야 합니다.
    - 이미지 URL을 직접 사용하여 웹사이트에 통합하세요.
    - 이미지에 대해 적절한 대체 텍스트를 한국어로 제공하세요.
    - 반응형 이미지를 위해 srcset과 sizes 속성을 사용하세요.
    - 이미지 지연 로딩을 위해 loading="lazy" 속성을 사용하세요.

    최신 웹 개발 기술과 라이브러리를 사용하세요 (예: Bootstrap 5).
    코드에 주석을 포함하고, 각 섹션을 명확히 구분해주세요.`;

    const chatCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "당신은 최고 수준의 한국인 웹 개발자입니다. 최신 웹 표준과 모범 사례를 준수하는 고품질 코드를 생성합니다." },
        { role: "user", content: initialPrompt }
      ],
      model: "mixtral-8x7b-32768",
      max_tokens: 16000,
      temperature: 0.6,
    });

    let generatedCode = chatCompletion.choices[0].message.content.trim();
    
    // HTML 코드 추출 및 기본적인 후처리
    const htmlStartIndex = generatedCode.indexOf('<!DOCTYPE html>');
    const htmlEndIndex = generatedCode.lastIndexOf('</html>');
    
    if (htmlStartIndex !== -1 && htmlEndIndex !== -1) {
      generatedCode = generatedCode.substring(htmlStartIndex, htmlEndIndex + 7);
      
      // 기본적인 후처리
      generatedCode = generatedCode.replace(/\$\{companyName\}/g, companyName);
      generatedCode = generatedCode.replace(/\$\{industry\}/g, industry);
      generatedCode = generatedCode.replace(/\$\{primaryColor\}/g, primaryColor);
    } else {
      throw new Error('유효한 HTML 코드를 생성하지 못했습니다.');
    }

    // 증분적 개선을 위한 추가 프롬프트
    const improvementPrompt = `다음 웹사이트 코드를 검토하고 개선해주세요:

${generatedCode}

특히 다음 사항에 주의해주세요:
1. 성능 최적화 (이미지 최적화, CSS/JS 최소화)
2. 접근성 향상 (ARIA 레이블, 키보드 네비게이션)
3. 디자인 일관성 및 시각적 개선
4. 반응형 디자인 개선
5. 코드 구조 및 가독성
6. SEO 최적화
7. 보안 강화 (XSS 방지 등)

개선된 코드를 제공해주세요.`;

    const improvementCompletion = await client.chat.completions.create({
      messages: [
        { role: "system", content: "당신은 최고 수준의 한국인 웹 개발자입니다. 주어진 코드를 검토하고 개선합니다." },
        { role: "user", content: improvementPrompt }
      ],
      model: "mixtral-8x7b-32768",
      max_tokens: 16000,
      temperature: 0.5,
    });

    let improvedCode = improvementCompletion.choices[0].message.content.trim();
    
    // 개선된 코드에서 HTML 추출
    const improvedHtmlStartIndex = improvedCode.indexOf('<!DOCTYPE html>');
    const improvedHtmlEndIndex = improvedCode.lastIndexOf('</html>');
    
    if (improvedHtmlStartIndex !== -1 && improvedHtmlEndIndex !== -1) {
      improvedCode = improvedCode.substring(improvedHtmlStartIndex, improvedHtmlEndIndex + 7);
    } else {
      improvedCode = generatedCode; // 개선 실패 시 원본 코드 사용
    }

    res.json({ websiteCode: improvedCode });
  } catch (error) {
    console.error('Error generating website code:', error);
    res.status(500).json({ error: '웹사이트 코드 생성 중 오류가 발생했습니다.', details: error.message });
  }
});

app.use(errorHandler);

exports.groqApi = functions.https.onRequest(app);