// 퀴즈 상태 클래스
class QuizApp {
  constructor() {
    this.allQuestions = [];
    this.quizQuestions = [];
    this.currentIndex = 0;
    this.selectedOption = null;
    this.answersLog = []; // { questionId, chosenOption, isCorrect, timeSpent }
    
    // 타이머 및 시간 관련
    this.attemptNum = 1; // 1: 무제한, 2: 2분, 3: 1분
    this.timeLimitPerQuestion = 0; // 초 단위 (0 = 무제한)
    this.questionTimer = null;
    this.timeLeft = 0;
    this.questionStartTime = 0;
    this.totalDuration = 0;
    this.totalTimerInterval = null;

    // DOM 요소 캐시
    this.screens = {
      home: document.getElementById('screen-home'),
      study: document.getElementById('screen-study'),
      start: document.getElementById('screen-start'),
      quiz: document.getElementById('screen-quiz'),
      result: document.getElementById('screen-result')
    };

    this.btnStart = document.getElementById('btn-start');
    this.btnSubmit = document.getElementById('btn-submit');
    this.btnNext = document.getElementById('btn-next');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnHome = document.getElementById('btn-home');

    // 포털 페이지 전용 버튼
    this.btnGotoStudy = document.getElementById('btn-goto-study');
    this.btnGotoQuiz = document.getElementById('btn-goto-quiz');
    this.logoHomeTrigger = document.getElementById('logo-home-trigger');

    // 글로벌 네비게이션 바 캐시
    this.navs = {
      home: document.getElementById('nav-home'),
      study: document.getElementById('nav-study'),
      quiz: document.getElementById('nav-quiz')
    };

    this.init();
  }

  async init() {
    try {
      // 1. 마크다운 리소스 런타임 Fetch
      // 브라우저 직접 로드 및 빌드 환경 모두 호환되는 fetch 방식을 사용합니다.
      const response = await fetch('./설비보전기사 필기 모의고사 260721.md');
      if (!response.ok) {
        throw new Error(`마크다운 파일 로드 실패: ${response.status} ${response.statusText}`);
      }
      
      const mdText = await response.text();

      // 2. 마크다운 데이터 파싱
      this.allQuestions = this.parseMarkdown(mdText);
      console.log(`Parsed ${this.allQuestions.length} questions successfully.`);

      // 3. 이벤트 리스너 바인딩
      this.bindEvents();

      // 4. MathJax 초기화 및 페이지 첫 렌더링
      this.triggerMathJax();
      
      // 불러오기가 완료되면 버튼 등 활성화
      if (this.btnStart) this.btnStart.disabled = false;
    } catch (error) {
      console.error("퀴즈 데이터를 초기화하지 못했습니다:", error);
      alert("퀴즈 데이터를 불러오는데 실패했습니다. 마크다운 파일 경로를 확인해주세요.");
    }
  }

  // 마크다운 파서 구현
  parseMarkdown(mdText) {
    const questions = [];
    // "### " 키워드를 기준으로 문제를 나눕니다.
    const parts = mdText.split(/\n###\s+/);
    
    // 첫 번째 파트는 파일 제목이나 서론이므로 무시하고 index 1부터 봅니다.
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      const lines = part.split('\n');
      if (lines.length === 0) continue;

      // 첫 번째 줄: 번호와 질문
      // 예: "1. 다음과 같이 진동..."
      const firstLine = lines[0].trim();
      const numMatch = firstLine.match(/^(\d+)\.\s*(.*)/);
      if (!numMatch) {
        // 문제 번호 매칭 실패 시 첫 줄 전체를 질문으로 시도
        continue;
      }

      const qId = parseInt(numMatch[1]);
      const qText = numMatch[2].trim();

      // 나머지 줄들을 합쳐서 파싱
      const body = lines.slice(1).join('\n').trim();

      // 1. 보기 추출 (- ① 나사 고정 형태)
      const options = [];
      const optionRegex = /-\s*[①②③④]\s*(.*)/g;
      let optionMatch;
      while ((optionMatch = optionRegex.exec(body)) !== null) {
        options.push(optionMatch[1].trim());
      }

      // 만약 정규식으로 보기가 안 잡히면 fallback
      if (options.length === 0) {
        const fallbacks = body.matchAll(/^[①②③④]\s*(.*)/gm);
        for (const fb of fallbacks) {
          options.push(fb[1].trim());
        }
      }

      // 2. 정답 추출 (**정답:** ② 형태)
      const ansMatch = body.match(/\*\*정답:\*\*\s*([①②③④\d])/);
      let ansIndex = -1;
      if (ansMatch) {
        const ansChar = ansMatch[1].trim();
        if (ansChar === '①' || ansChar === '1') ansIndex = 0;
        else if (ansChar === '②' || ansChar === '2') ansIndex = 1;
        else if (ansChar === '③' || ansChar === '3') ansIndex = 2;
        else if (ansChar === '④' || ansChar === '4') ansIndex = 3;
      }

      // 3. 상세 해설 추출
      let explanation = "";
      const expStart = body.indexOf('**상세 해설:**');
      if (expStart !== -1) {
        const expBody = body.substring(expStart + '**상세 해설:**'.length).trim();
        // 학습 포인트가 뒤에 나오면 그 전까지만 해설로 저장
        const lpIndex = expBody.indexOf('**학습 포인트:**');
        if (lpIndex !== -1) {
          explanation = expBody.substring(0, lpIndex).trim();
        } else {
          explanation = expBody;
        }
      }

      // 4. 학습 포인트 추출
      let learningPoint = "";
      const lpStart = body.indexOf('**학습 포인트:**');
      if (lpStart !== -1) {
        learningPoint = body.substring(lpStart + '**학습 포인트:**'.length).trim();
      }

      // 5. 과목 판단
      let subject = "";
      if (qId <= 20) subject = "제1과목: 설비 진단 및 계측";
      else if (qId <= 40) subject = "제2과목: 설비관리";
      else if (qId <= 60) subject = "제3과목: 기계일반 및 기계보전";
      else if (qId <= 80) subject = "제4과목: 윤활관리";
      else subject = "제5과목: 공유압 및 자동화";

      questions.push({
        id: qId,
        subject: subject,
        question: qText,
        options: options,
        answer: ansIndex,
        explanation: explanation,
        learningPoint: learningPoint
      });
    }

    return questions;
  }

  // MathJax 수식 렌더링 호출
  triggerMathJax() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch((err) => console.log('MathJax typeset failed: ', err));
    }
  }

  bindEvents() {
    // 글로벌 상단 네비게이션 클릭 이벤트
    this.navs.home.addEventListener('click', () => {
      this.goToHome();
    });

    this.navs.study.addEventListener('click', () => {
      // 퀴즈 진행 중 타이머 해제 및 홈으로 가는 안전장치 동작
      if (this.questionTimer) clearInterval(this.questionTimer);
      if (this.totalTimerInterval) clearInterval(this.totalTimerInterval);
      
      this.switchScreen('study');
      this.triggerMathJax();
    });

    this.navs.quiz.addEventListener('click', () => {
      // 퀴즈가 이미 진행 중이거나 결과 화면일 때는 화면 유지
      if (this.screens.quiz.classList.contains('active') || this.screens.result.classList.contains('active')) {
        return;
      }
      this.switchScreen('start');
    });

    // 포털 대시보드 카드 네비게이션
    this.btnGotoStudy.addEventListener('click', () => {
      this.switchScreen('study');
      this.triggerMathJax();
    });

    this.btnGotoQuiz.addEventListener('click', () => {
      this.switchScreen('start');
    });

    this.logoHomeTrigger.addEventListener('click', () => {
      this.goToHome();
    });

    // "메인으로" 클래스를 가진 모든 버튼 일괄 리스너 추가
    const backHomeBtns = document.querySelectorAll('.btn-back-home');
    backHomeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.goToHome());
    });

    // 칩 선택 (문제 수 & 회차 설정)
    const countChips = document.querySelectorAll('#question-count-chips .chip');
    countChips.forEach(chip => {
      chip.addEventListener('click', () => {
        countChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    const attemptChips = document.querySelectorAll('#attempt-select-chips .chip');
    attemptChips.forEach(chip => {
      chip.addEventListener('click', () => {
        attemptChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        // 메인 카드 UI에서 뱃지 및 설명 스타일 갱신 유도
        const attempt = parseInt(chip.getAttribute('data-attempt'));
        this.updateAttemptUI(attempt);
      });
    });

    // 화면 이동 버튼
    this.btnStart.addEventListener('click', () => this.startQuiz());
    this.btnSubmit.addEventListener('click', () => this.submitAnswer());
    this.btnNext.addEventListener('click', () => this.nextQuestion());
    this.btnRetry.addEventListener('click', () => this.retryQuiz());
    this.btnHome.addEventListener('click', () => this.goToHome());
  }

  updateAttemptUI(attempt) {
    const info1 = document.getElementById('mode-info-1');
    const info2 = document.getElementById('mode-info-2');
    const info3 = document.getElementById('mode-info-3');

    // 비활성화 처리
    if (info1) info1.classList.remove('active');
    if (info2) info2.classList.remove('active');
    if (info3) info3.classList.remove('active');

    // 배지 갱신
    const attemptBadge = document.getElementById('attempt-badge');
    attemptBadge.className = 'badge';

    if (attempt === 1) {
      if (info1) info1.classList.add('active');
      attemptBadge.classList.add('attempt-1');
      attemptBadge.textContent = '1회차: 연습 모드';
    } else if (attempt === 2) {
      if (info2) info2.classList.add('active');
      attemptBadge.classList.add('attempt-2');
      attemptBadge.textContent = '2회차: 실전 모드 (2분)';
    } else if (attempt === 3) {
      if (info3) info3.classList.add('active');
      attemptBadge.classList.add('attempt-3');
      attemptBadge.textContent = '3회차: 타임어택 (1분)';
    }
  }

  switchScreen(screenName) {
    Object.keys(this.screens).forEach(name => {
      this.screens[name].classList.remove('active');
    });
    this.screens[screenName].classList.add('active');
    
    // 글로벌 내비게이션 탭 하이라이트 갱신
    this.updateNavState(screenName);
    
    window.scrollTo(0, 0);
  }

  updateNavState(screenName) {
    Object.values(this.navs).forEach(nav => nav.classList.remove('active'));
    
    if (screenName === 'home') {
      this.navs.home.classList.add('active');
    } else if (screenName === 'study') {
      this.navs.study.classList.add('active');
    } else if (screenName === 'start' || screenName === 'quiz' || screenName === 'result') {
      this.navs.quiz.classList.add('active');
    }
  }

  // 퀴즈 시작
  startQuiz() {
    // 1. 설정 수집
    const activeCountChip = document.querySelector('#question-count-chips .chip.active');
    const questionCount = parseInt(activeCountChip.getAttribute('data-count'));

    const activeAttemptChip = document.querySelector('#attempt-select-chips .chip.active');
    this.attemptNum = parseInt(activeAttemptChip.getAttribute('data-attempt'));

    // 2. 타이머 룰 설정
    if (this.attemptNum === 1) {
      this.timeLimitPerQuestion = 0; // 무제한
    } else if (this.attemptNum === 2) {
      this.timeLimitPerQuestion = 120; // 2분
    } else if (this.attemptNum === 3) {
      this.timeLimitPerQuestion = 60; // 1분
    }

    // 3. 문제 추출 (랜덤 셔플 후 n개 자르기)
    this.quizQuestions = this.shuffleArray([...this.allQuestions]).slice(0, questionCount);
    
    // 4. 상태 리셋
    this.currentIndex = 0;
    this.answersLog = [];
    this.selectedOption = null;
    this.totalDuration = 0;

    // 5. 전체 소요시간 측정 시작
    if (this.totalTimerInterval) clearInterval(this.totalTimerInterval);
    this.totalTimerInterval = setInterval(() => {
      this.totalDuration++;
    }, 1000);

    // 6. 화면 갱신 및 첫 문제 표시
    this.switchScreen('quiz');
    this.loadQuestion();
  }

  // 문제 로드
  loadQuestion() {
    this.selectedOption = null;
    this.btnSubmit.disabled = true;
    this.btnSubmit.classList.remove('hide');
    this.btnNext.classList.add('hide');

    const question = this.quizQuestions[this.currentIndex];

    // 메타 정보
    document.getElementById('quiz-subject').textContent = question.subject;
    document.getElementById('quiz-counter').textContent = `${this.currentIndex + 1} / ${this.quizQuestions.length}`;
    
    // 진행바
    const progressPercent = ((this.currentIndex) / this.quizQuestions.length) * 100;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;

    // 문제 본문
    document.getElementById('question-display-num').textContent = `Q. ${String(question.id).padStart(2, '0')}`;
    document.getElementById('question-text').textContent = question.question;

    // 보기 카드 렌더링
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    question.options.forEach((optText, index) => {
      const optCard = document.createElement('button');
      optCard.className = 'option-card';
      optCard.innerHTML = `
        <span class="option-index">${index + 1}</span>
        <span class="option-content">${optText}</span>
      `;
      optCard.addEventListener('click', () => this.selectOption(index));
      optionsContainer.appendChild(optCard);
    });

    // 타이머 셋업
    this.startQuestionTimer();

    // LaTeX 수식 적용
    this.triggerMathJax();
  }

  // 보기 선택
  selectOption(index) {
    // 답안이 이미 제출되었거나 시간초과된 상태에서는 클릭 무시
    if (!this.btnNext.classList.contains('hide')) return;

    this.selectedOption = index;
    const optionCards = document.querySelectorAll('#quiz-options .option-card');
    optionCards.forEach((card, idx) => {
      if (idx === index) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    this.btnSubmit.disabled = false;
  }

  // 문제별 타이머 구동
  startQuestionTimer() {
    if (this.questionTimer) clearInterval(this.questionTimer);
    
    const timerElement = document.getElementById('quiz-timer');
    this.questionStartTime = Date.now();

    if (this.timeLimitPerQuestion === 0) {
      // 시간 제한 없음
      timerElement.textContent = '무제한';
      timerElement.className = 'meta-value timer-unlimited';
      return;
    }

    this.timeLeft = this.timeLimitPerQuestion;
    this.updateTimerDisplay();

    this.questionTimer = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();

      if (this.timeLeft <= 0) {
        clearInterval(this.questionTimer);
        this.handleTimeOut();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const timerElement = document.getElementById('quiz-timer');
    
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    timerElement.textContent = timeStr;

    // 시간에 따라 경고 색상 변경
    if (this.timeLeft > 30) {
      timerElement.className = 'meta-value timer-normal';
    } else if (this.timeLeft > 10) {
      timerElement.className = 'meta-value timer-warning';
    } else {
      timerElement.className = 'meta-value timer-danger';
    }
  }

  // 시간 초과 처리
  handleTimeOut() {
    // 선택되지 않은 오답 처리
    const question = this.quizQuestions[this.currentIndex];
    
    // 오답 기록
    this.answersLog.push({
      questionId: question.id,
      chosenOption: null, // 시간초과는 선택 없음
      isCorrect: false,
      timeSpent: this.timeLimitPerQuestion
    });

    // 화면 표시 (옵션 카드 모두 비활성화하고 정답 하이라이트)
    const optionCards = document.querySelectorAll('#quiz-options .option-card');
    optionCards.forEach((card, idx) => {
      if (idx === question.answer) {
        card.classList.add('correct');
      } else {
        card.style.opacity = '0.5';
      }
    });

    // 타이머 텍스트 갱신
    const timerElement = document.getElementById('quiz-timer');
    timerElement.textContent = '시간 초과';
    timerElement.className = 'meta-value timer-danger';

    // 버튼 활성화 토글
    this.btnSubmit.classList.add('hide');
    this.btnNext.classList.remove('hide');
  }

  // 답안 제출
  submitAnswer() {
    if (this.selectedOption === null) return;
    
    // 타이머 중지
    if (this.questionTimer) clearInterval(this.questionTimer);

    const question = this.quizQuestions[this.currentIndex];
    const isCorrect = this.selectedOption === question.answer;
    const timeSpent = this.timeLimitPerQuestion > 0 
      ? this.timeLimitPerQuestion - this.timeLeft 
      : Math.floor((Date.now() - this.questionStartTime) / 1000);

    // 기록 추가
    this.answersLog.push({
      questionId: question.id,
      chosenOption: this.selectedOption,
      isCorrect: isCorrect,
      timeSpent: timeSpent
    });

    // UI 하이라이트 표시
    const optionCards = document.querySelectorAll('#quiz-options .option-card');
    optionCards.forEach((card, idx) => {
      card.classList.remove('selected');
      if (idx === question.answer) {
        card.classList.add('correct');
      } else if (idx === this.selectedOption) {
        card.classList.add('wrong');
      } else {
        card.style.opacity = '0.5';
      }
    });

    this.btnSubmit.classList.add('hide');
    this.btnNext.classList.remove('hide');
  }

  // 다음 문제
  nextQuestion() {
    this.currentIndex++;
    if (this.currentIndex < this.quizQuestions.length) {
      this.loadQuestion();
    } else {
      this.showResult();
    }
  }

  // 결과 화면
  showResult() {
    // 전체 시간 타이머 정지
    if (this.totalTimerInterval) clearInterval(this.totalTimerInterval);
    if (this.questionTimer) clearInterval(this.questionTimer);

    const correctCount = this.answersLog.filter(log => log.isCorrect).length;
    const wrongCount = this.quizQuestions.length - correctCount;
    const scorePercent = Math.round((correctCount / this.quizQuestions.length) * 100);

    // 점수 갱신
    document.getElementById('result-score-percent').textContent = `${scorePercent}%`;
    document.getElementById('result-score-fraction').textContent = `${correctCount} / ${this.quizQuestions.length}`;

    // SVG 원형 차트 애니메이션
    const circleFill = document.getElementById('score-ring-fill');
    const radius = circleFill.r.baseVal.value;
    const circumference = 2 * Math.PI * radius; // 약 439.8
    const offset = circumference - (scorePercent / 100) * circumference;
    
    circleFill.style.strokeDasharray = `${circumference}`;
    circleFill.style.strokeDashoffset = `${circumference}`;
    
    // 약간의 딜레이 후 부드러운 애니메이션
    setTimeout(() => {
      circleFill.style.strokeDashoffset = `${offset}`;
    }, 100);

    // 미니 통계 설정
    document.getElementById('stat-correct').textContent = correctCount;
    document.getElementById('stat-wrong').textContent = wrongCount;

    const min = Math.floor(this.totalDuration / 60);
    const sec = this.totalDuration % 60;
    document.getElementById('stat-duration').textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    // 하단 리트라이 버튼 레이블 설정
    let nextAttempt = this.attemptNum + 1;
    if (nextAttempt > 3) nextAttempt = 1; // 3회차 이상 시 다시 1회차로 순환

    const retryBtnText = document.getElementById('retry-btn-text');
    if (nextAttempt === 2) {
      retryBtnText.textContent = '다시 풀기 (2회차 - 2분 제한)';
    } else if (nextAttempt === 3) {
      retryBtnText.textContent = '다시 풀기 (3회차 - 1분 제한)';
    } else {
      retryBtnText.textContent = '다시 풀기 (1회차 - 무제한)';
    }

    // 오답 리뷰 리스트 작성
    this.buildReviewList();

    this.switchScreen('result');
  }

  // 리뷰 리스트 돔 빌드
  buildReviewList() {
    const reviewContainer = document.getElementById('review-list');
    reviewContainer.innerHTML = '';

    this.quizQuestions.forEach((q, idx) => {
      const log = this.answersLog.find(l => l.questionId === q.id);
      const isCorrect = log ? log.isCorrect : false;
      const chosen = log ? log.chosenOption : null;

      const reviewItem = document.createElement('div');
      reviewItem.className = 'review-item';

      // 헤더 정보
      reviewItem.innerHTML = `
        <div class="review-item-header">
          <span class="review-q-num">Q. ${String(q.id).padStart(2, '0')}</span>
          <h4 class="review-q-text">${q.question}</h4>
          <span class="review-status-badge ${isCorrect ? 'correct' : 'wrong'}">
            ${isCorrect ? '정답' : (chosen === null ? '시간초과' : '오답')}
          </span>
        </div>
      `;

      // 보기 목록 생성
      const optUl = document.createElement('ul');
      optUl.className = 'review-options';
      
      q.options.forEach((optText, optIdx) => {
        const optLi = document.createElement('li');
        optLi.className = 'review-opt';
        optLi.textContent = `①②③④`[optIdx] + ` ${optText}`;

        if (optIdx === q.answer) {
          optLi.classList.add('correct');
        } else if (optIdx === chosen && !isCorrect) {
          optLi.classList.add('wrong-chosen');
        }
        optUl.appendChild(optLi);
      });
      reviewItem.appendChild(optUl);

      // 해설 생성
      if (q.explanation) {
        const expDiv = document.createElement('div');
        expDiv.className = 'review-explanation';
        expDiv.innerHTML = `
          <h4>상세 해설</h4>
          <p>${q.explanation}</p>
        `;
        reviewItem.appendChild(expDiv);
      }

      // 학습 포인트 생성
      if (q.learningPoint) {
        const lpDiv = document.createElement('div');
        lpDiv.className = 'review-lp';
        lpDiv.innerHTML = `
          <h4>학습 포인트</h4>
          <p>${q.learningPoint}</p>
        `;
        reviewItem.appendChild(lpDiv);
      }

      reviewContainer.appendChild(reviewItem);
    });

    this.triggerMathJax();
  }

  // 다시 풀기
  retryQuiz() {
    // 회차를 다음 단계로 순환 설정
    let nextAttempt = this.attemptNum + 1;
    if (nextAttempt > 3) nextAttempt = 1;

    // 메인 홈 화면 칩 선택 업데이트
    const attemptChips = document.querySelectorAll('#attempt-select-chips .chip');
    attemptChips.forEach(chip => {
      const att = parseInt(chip.getAttribute('data-attempt'));
      if (att === nextAttempt) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    this.updateAttemptUI(nextAttempt);
    this.startQuiz();
  }

  // 처음으로/홈으로 가기
  goToHome() {
    // 진행 중이던 타이머가 있다면 정지
    if (this.questionTimer) clearInterval(this.questionTimer);
    if (this.totalTimerInterval) clearInterval(this.totalTimerInterval);
    
    this.switchScreen('home');
  }

  // 유틸 함수: 배열 셔플 (Fisher-Yates)
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

// 앱 실행
document.addEventListener('DOMContentLoaded', () => {
  new QuizApp();
});
