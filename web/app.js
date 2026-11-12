const inputMode = document.querySelector('#inputMode');
const outputMode = document.querySelector('#outputMode');
const targetLanguage = document.querySelector('#targetLanguage');
const routeNote = document.querySelector('#routeNote span:nth-child(2)');
const textPanel = document.querySelector('#textPanel');
const mediaPanel = document.querySelector('#mediaPanel');
const mediaFile = document.querySelector('#mediaFile');
const mediaTitle = document.querySelector('#mediaTitle');
const mediaDescription = document.querySelector('#mediaDescription');
const uploadLabel = document.querySelector('#uploadLabel');
const cameraButton = document.querySelector('#cameraButton');
const recognitionMode = document.querySelector('#recognitionMode');
const recognitionModeWrap = document.querySelector('#recognitionModeWrap');
const videoPreview = document.querySelector('#videoPreview');
const audioPreview = document.querySelector('#audioPreview');
const cameraPreview = document.querySelector('#cameraPreview');
const previewWrap = document.querySelector('#previewWrap');
const resultCard = document.querySelector('#resultCard');
const resultContent = document.querySelector('#resultContent');
let mediaUrl = null;
let cameraStream = null;
let recorder = null;
let audioChunks = [];
let cameraVideoFile = null;
let liveRecognition = false;
let liveTimer = null;
let liveFrames = [];
let liveVotes = [];
let uncertainWindows = 0;
let lastEmittedLabel = '';
let transcript = [];
let inferenceBusy = false;
let liveSession = 0;
let backendHealth = null;

const API = 'http://127.0.0.1:4174';

async function checkBackend() {
  const badge = document.querySelector('#backendStatus');
  const cardState = document.querySelector('#recognizerState');
  try {
    const response = await fetch(`${API}/api/health`);
    const health = await response.json();
    backendHealth = health;
    badge.innerHTML = `<i></i> ${health.model_available ? 'Model ready' : 'Model setup needed'}`;
    cardState.textContent = health.model_available ? `ISOLATED ${health.vocabulary_size}-SIGN MODEL` : 'MODEL NOT TRAINED YET';
    cardState.className = `cap-status ${health.model_available ? 'available' : 'planned'}`;
    if (!health.model_available) routeNote.textContent = 'The live camera interface is ready; train the isolated-sign recognizer to enable sign predictions.';
  } catch {
    badge.innerHTML = '<i></i> API offline';
    cardState.textContent = 'API OFFLINE';
  }
}

const routeMessages = {
  'video:text': 'Upload a short clip of one isolated sign. The local 49-label model returns its top candidates for your review.',
  'video:speech': 'Upload a short isolated sign clip. Review the model’s label candidates, then speak the selected label.',
  'video:sign': 'This route is unsupported: video recognition and verified sign output assets are not available yet.',
  'video:both': 'Upload one isolated sign. Review the top candidate labels and speak your selected result.',
  'camera:text': 'Start live recognition. Confirmed isolated signs appear in a running text transcript.',
  'camera:speech': 'Start live recognition. Confirmed isolated signs appear as text and are spoken aloud.',
  'camera:sign': 'This route is unsupported: live recognition and verified sign output assets are not available yet.',
  'camera:both': 'Start live recognition to build a transcript and speak each confirmed sign.',
  'audio:text': 'Audio preview works locally. Speech transcription (ASR) is not connected yet.',
  'audio:speech': 'Audio playback is available in the preview. Transcription and sign conversion are not part of this route.',
  'audio:sign': 'This route is unsupported: ASR and verified sign output assets are not available yet.',
  'audio:both': 'Audio preview works locally. Transcription is needed before text or generated speech can be returned.',
  'microphone:text': 'Microphone access is only used for capture. Speech transcription is not connected yet.',
  'microphone:speech': 'Microphone input does not require generated speech; transcription is not connected yet.',
  'microphone:sign': 'This route is unsupported: speech transcription and verified sign output assets are not available yet.',
  'microphone:both': 'Microphone capture can be previewed only after permission. Speech transcription is not connected yet.',
  'text:text': 'Typed text is ready to display. No translation is performed.',
  'text:speech': 'Type a message and use your browser’s installed speech voice to hear it.',
  'text:sign': 'Look up one recorded sign example by an exact dataset label. Sentence-to-ISL translation is not implemented.',
  'text:both': 'Typed text can be displayed and spoken with a browser voice. No sign translation is performed.'
};

function modeChanged() {
  const input = inputMode.value;
  const output = outputMode.value;
  routeNote.textContent = routeMessages[`${input}:${output}`];
  textPanel.classList.toggle('hidden', input !== 'text');
  mediaPanel.classList.toggle('hidden', input === 'text');
  document.querySelector('#inputIcon').textContent = ({video:'▧',camera:'◉',audio:'♫',microphone:'⌁',text:'T'})[input];
  document.querySelector('#outputIcon').textContent = ({text:'▤',speech:'♫',sign:'◉',both:'↔'})[output];
  mediaFile.value = '';
  clearMedia();
  cameraButton.classList.toggle('hidden', input !== 'camera' && input !== 'microphone');
  cameraButton.textContent = input === 'microphone' ? 'Record audio' : 'Enable camera';
  document.querySelector('#runButton').classList.toggle('hidden', input === 'camera');
  uploadLabel.classList.toggle('hidden', input === 'camera' || input === 'microphone');
  recognitionModeWrap.classList.toggle('hidden', input !== 'camera');
  if (input === 'camera') {
    mediaTitle.textContent = 'Start live sign recognition';
    mediaDescription.textContent = 'The camera is sampled locally. Confirmed isolated signs are added to a transcript and can be spoken aloud.';
  } else if (input === 'microphone') {
    mediaTitle.textContent = 'Record a local audio sample';
    mediaDescription.textContent = 'You can record and play it back here. Speech transcription (ASR) is not connected.';
  } else if (input === 'audio') {
    mediaTitle.textContent = 'Add an audio file';
    mediaDescription.textContent = 'Choose an audio file to preview it locally. Speech recognition is not connected.';
    mediaFile.accept = 'audio/*'; uploadLabel.textContent = 'Choose audio';
  } else {
    mediaTitle.textContent = 'Add a video clip';
    mediaDescription.textContent = 'Choose an MP4, WebM, or MOV file to preview it locally.';
    mediaFile.accept = 'video/*'; uploadLabel.textContent = 'Choose video';
  }
  resultCard.classList.add('hidden');
}

function clearMedia() {
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  mediaUrl = null;
  videoPreview.pause(); videoPreview.removeAttribute('src'); videoPreview.load();
  audioPreview.pause(); audioPreview.removeAttribute('src'); audioPreview.load();
  videoPreview.classList.add('hidden'); audioPreview.classList.add('hidden');
  previewWrap.classList.add('hidden');
  liveRecognition = false;
  liveSession++;
  if (liveTimer) clearInterval(liveTimer);
  liveTimer = null;
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  cameraPreview.srcObject = null; cameraPreview.classList.add('hidden');
  cameraVideoFile = null;
}

mediaFile.addEventListener('change', () => {
  const file = mediaFile.files?.[0];
  if (!file) return;
  clearMedia();
  mediaUrl = URL.createObjectURL(file);
  previewWrap.classList.remove('hidden');
  if (file.type.startsWith('audio/')) {
    audioPreview.src = mediaUrl; audioPreview.classList.remove('hidden');
  } else {
    videoPreview.src = mediaUrl; videoPreview.classList.remove('hidden');
  }
});

cameraButton.addEventListener('click', async () => {
  if (inputMode.value === 'microphone') {
    try {
      if (recorder?.state === 'recording') { recorder.stop(); cameraButton.textContent = 'Record audio'; return; }
      clearMedia();
      cameraStream = await navigator.mediaDevices.getUserMedia({audio: true});
      recorder = new MediaRecorder(cameraStream); audioChunks = [];
      recorder.addEventListener('dataavailable', event => { if (event.data.size) audioChunks.push(event.data); });
      recorder.addEventListener('stop', () => {
        cameraStream?.getTracks().forEach(track => track.stop()); cameraStream = null;
        mediaUrl = URL.createObjectURL(new Blob(audioChunks, {type: recorder.mimeType || 'audio/webm'}));
        audioPreview.src = mediaUrl; audioPreview.classList.remove('hidden'); previewWrap.classList.remove('hidden');
        mediaTitle.textContent = 'Recording ready for playback';
        cameraButton.textContent = 'Record again';
      }, {once: true});
      recorder.start(); cameraButton.textContent = 'Stop recording'; mediaTitle.textContent = 'Recording in this browser…';
    } catch (error) {
      mediaTitle.textContent = 'Microphone permission unavailable';
      mediaDescription.textContent = error.name === 'NotAllowedError' ? 'Allow microphone access in your browser to record locally.' : 'No microphone could be opened. Check that one is connected.';
      mediaDescription.classList.add('media-error');
    }
    return;
  }
  try {
    if (!cameraStream) {
      cameraStream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
      cameraPreview.srcObject = cameraStream;
      cameraPreview.classList.remove('hidden');
      mediaTitle.textContent = 'Camera preview is live';
      cameraButton.textContent = 'Start live recognition';
      return;
    }
    if (liveRecognition) {
      stopLiveRecognition();
      return;
    }
    startLiveRecognition();
  } catch (error) {
    mediaTitle.textContent = 'Camera permission unavailable';
    mediaDescription.textContent = error.name === 'NotAllowedError' ? 'Allow camera access in your browser to preview the feed.' : 'No camera could be opened. Check that a camera is connected.';
    mediaDescription.classList.add('media-error');
  }
});

document.querySelector('#removeMedia').addEventListener('click', () => { clearMedia(); mediaFile.value = ''; });
document.querySelector('#clearText').addEventListener('click', () => { document.querySelector('#textInput').value = ''; updateCount(); });
function updateCount() { document.querySelector('#charCount').textContent = `${document.querySelector('#textInput').value.length} / 500`; }
document.querySelector('#textInput').addEventListener('input', updateCount);
inputMode.addEventListener('change', modeChanged);
targetLanguage.addEventListener('change', updateLiveTranslation);
recognitionMode.addEventListener('change', () => {
  if (recognitionMode.value === 'continuous') {
    routeNote.textContent = backendHealth?.sentence_model_available
      ? 'Continuous mode uses the sentence translation model.'
      : 'Sentence mode is selected, but no trained continuous translation model is installed yet.';
  } else {
    routeNote.textContent = 'One sign at a time uses the installed word classifier. Low-score candidates can be reviewed manually.';
  }
});
outputMode.addEventListener('change', () => {
  routeNote.textContent = routeMessages[`${inputMode.value}:${outputMode.value}`];
  document.querySelector('#outputIcon').textContent = ({text:'▤',speech:'♫',sign:'◉',both:'↔'})[outputMode.value];
});

function showResult(title, body, state = 'READY', actions = '') {
  document.querySelector('#resultTitle').textContent = title;
  document.querySelector('#resultState').textContent = state;
  resultContent.innerHTML = body + actions;
  resultCard.classList.remove('hidden');
  resultCard.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function stopLiveRecognition() {
  liveRecognition = false;
  liveSession++;
  if (liveTimer) clearInterval(liveTimer);
  liveTimer = null;
  cameraButton.textContent = 'Start live recognition';
  mediaTitle.textContent = 'Live camera is paused';
  document.querySelector('#resultState').textContent = 'PAUSED';
}

async function startLiveRecognition() {
  try {
    const healthResponse = await fetch(`${API}/api/health`);
    const health = await healthResponse.json();
    backendHealth = health;
    if (recognitionMode.value === 'continuous' && !health.sentence_model_available) {
      throw new Error('No continuous sentence model is installed. The current trained checkpoint recognizes isolated signs only.');
    }
    if (!health.model_available) throw new Error('Train or install the local recognition model before starting live recognition.');
    if (cameraPreview.readyState < 2) await new Promise(resolve => cameraPreview.addEventListener('loadeddata', resolve, {once:true}));
    liveFrames = []; liveVotes = []; transcript = []; uncertainWindows = 0; lastEmittedLabel = '';
    liveRecognition = true;
    const session = ++liveSession;
    cameraButton.textContent = 'Stop live recognition';
    mediaTitle.textContent = recognitionMode.value === 'continuous' ? 'Continuous translation is running' : 'Live isolated-sign recognition is running';
    showResult('Live sign recognition', '<strong>Reviewed English transcript</strong><p id="liveTranscript" class="live-transcript">Waiting for a clear sign…</p><strong>Regional-language output</strong><p id="liveTranslation" class="live-transcript">Select a language to translate.</p><small>Literal translation of recognized labels; this does not add sentence grammar.</small><div class="live-candidate-panel"><strong>Review low-score candidates</strong><div id="liveCandidates"><small>Predictions will appear here.</small></div></div><small id="liveSpeechNotice"></small><br><small id="liveStatus">Collecting camera frames. Top-class scores are model scores, not guaranteed probabilities.</small>', 'STARTING');
    let lastInferenceAt = 0;
    liveTimer = setInterval(() => {
      if (!liveRecognition || !cameraPreview.videoWidth || inferenceBusy) return;
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = Math.round(320 * cameraPreview.videoHeight / cameraPreview.videoWidth);
      const context = canvas.getContext('2d', {willReadFrequently:false});
      context.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob || !liveRecognition) return;
        liveFrames.push(blob);
        if (liveFrames.length > 12) liveFrames.shift();
        const now = performance.now();
        if (liveFrames.length === 12 && now - lastInferenceAt >= 1500) {
          lastInferenceAt = now;
          predictLiveWindow([...liveFrames], session);
        }
      }, 'image/jpeg', 0.72);
    }, 200);
    document.querySelector('#resultState').textContent = 'LIVE';
  } catch (error) {
    liveRecognition = false;
    cameraButton.textContent = 'Start live recognition';
    showResult('Live recognition could not start', escapeHtml(error.message), 'UNAVAILABLE');
  }
}

async function predictLiveWindow(windowFrames, session) {
  inferenceBusy = true;
  try {
    const form = new FormData();
    form.append('mode', recognitionMode.value);
    windowFrames.forEach((frame, index) => form.append('frames', frame, `frame-${index}.jpg`));
    const response = await fetch(`${API}/api/predict-frames`, {method:'POST', body:form});
    const payload = await response.json();
    if (!liveRecognition || session !== liveSession) return;
    if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail));
    const status = document.querySelector('#liveStatus');
    if (status) status.textContent = `Window top-class score ${(payload.confidence * 100).toFixed(0)}% · ${payload.latency_ms.toFixed(0)} ms · a low score needs your review.`;
    const candidateNode = document.querySelector('#liveCandidates');
    if (candidateNode) {
      candidateNode.innerHTML = (payload.alternatives || []).map((candidate, index) => `<button type="button" class="candidate-choice" data-live-label="${escapeHtml(candidate.label)}">${index + 1}. ${escapeHtml(candidate.label)} · ${(candidate.confidence * 100).toFixed(1)}%</button>`).join('') || '<small>No candidates returned.</small>';
      candidateNode.querySelectorAll('[data-live-label]').forEach(button => button.addEventListener('click', () => acceptReviewedLabel(button.dataset.liveLabel || '')));
    }
    if (!payload.accepted) {
      uncertainWindows++;
      liveVotes = [];
      if (uncertainWindows >= 2) lastEmittedLabel = '';
      return;
    }
    uncertainWindows = 0;
    liveVotes.push(payload.label);
    if (liveVotes.length > 3) liveVotes.shift();
    const confirmed = liveVotes.filter(label => label === payload.label).length >= 2;
    if (!confirmed || payload.label === lastEmittedLabel) return;
    lastEmittedLabel = payload.label;
    transcript.push(payload.label);
    const transcriptNode = document.querySelector('#liveTranscript');
    if (transcriptNode) transcriptNode.textContent = transcript.join(' ');
    updateLiveTranslation();
    if (outputMode.value === 'speech' || outputMode.value === 'both') speakLiveText(payload.label);
  } catch (error) {
    if (!liveRecognition || session !== liveSession) return;
    const status = document.querySelector('#liveStatus');
    if (status) status.textContent = `Recognition paused: ${error.message}`;
  } finally {
    inferenceBusy = false;
  }
}

const speechTags = {kn:'kn-IN', hi:'hi-IN', ta:'ta-IN', te:'te-IN', ml:'ml-IN'};
let liveTranslationRequest = 0;
const translationCache = new Map();

async function translateText(text, language = targetLanguage.value) {
  if (language === 'en') return {translated_text:text, speech_tag:'en-US', provider:'None'};
  const cacheKey = `${language}\u0000${text}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);
  const response = await fetch(`${API}/api/translate`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text, target_language:language})
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail));
  translationCache.set(cacheKey, payload);
  if (translationCache.size > 200) translationCache.delete(translationCache.keys().next().value);
  return payload;
}

function waitForSpeechVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length) return Promise.resolve(voices);
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(speechSynthesis.getVoices());
    };
    speechSynthesis.addEventListener('voiceschanged', finish, {once:true});
    setTimeout(finish, 1500);
  });
}

function setSpeechNotice(message) {
  const notice = document.querySelector('#speechNotice') || document.querySelector('#liveSpeechNotice');
  if (notice) notice.textContent = message;
}

async function speakText(text, language = targetLanguage.value) {
  if (!('speechSynthesis' in window)) {
    setSpeechNotice('Speech synthesis is unavailable in this browser.');
    return false;
  }
  speechSynthesis.cancel();
  const voices = await waitForSpeechVoices();
  const requestedPrefix = language === 'en' ? 'en' : (speechTags[language] || language).slice(0, 2).toLowerCase();
  const voice = voices.find(item => item.lang.toLowerCase().startsWith(requestedPrefix));
  if (language !== 'en' && !voice) {
    const languageName = targetLanguage.querySelector(`option[value="${language}"]`)?.textContent || language;
    setSpeechNotice(`This browser has no ${languageName} speech voice, so it will not fall back to English. If Windows offers text-to-speech for ${languageName}, install it under Settings → Time & language → Language & region → Language options, then restart the browser. The translated text is still available above.`);
    return false;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechTags[language] || 'en-US';
  if (voice) utterance.voice = voice;
  setSpeechNotice(voice ? `Speaking with ${voice.name} (${voice.lang}).` : 'Speaking with the browser’s default English voice.');
  speechSynthesis.speak(utterance);
  return true;
}

async function speakLiveText(text) {
  const language = targetLanguage.value;
  try {
    const output = await translateText(text, language);
    speakText(output.translated_text, language);
  } catch (error) {
    const status = document.querySelector('#liveStatus');
    if (status) status.textContent = `Translation or speech unavailable: ${error.message}`;
  }
}

async function updateLiveTranslation() {
  const node = document.querySelector('#liveTranslation');
  if (!node) return;
  const requestId = ++liveTranslationRequest;
  const language = targetLanguage.value;
  if (language === 'en') { node.textContent = 'English selected'; return; }
  if (!transcript.length) { node.textContent = 'Waiting for recognized signs…'; return; }
  node.textContent = 'Translating recognized labels…';
  try {
    const translatedLabels = await Promise.all(transcript.map(label => translateText(label, language)));
    if (requestId === liveTranslationRequest && node.isConnected) node.textContent = translatedLabels.map(item => item.translated_text).join(' ');
  } catch (error) {
    if (requestId === liveTranslationRequest && node.isConnected) node.textContent = `Translation unavailable: ${error.message}`;
  }
}

function acceptReviewedLabel(label) {
  if (!label) return;
  transcript.push(label);
  const transcriptNode = document.querySelector('#liveTranscript');
  if (transcriptNode) transcriptNode.textContent = transcript.join(' ');
  updateLiveTranslation();
  if (outputMode.value === 'speech' || outputMode.value === 'both') speakLiveText(label);
  const status = document.querySelector('#liveStatus');
  if (status) status.textContent = `You selected “${label}”. Review future low-score suggestions the same way.`;
}

document.querySelector('#runButton').addEventListener('click', async () => {
  const input = inputMode.value, output = outputMode.value;
  if (input === 'text') {
    const message = document.querySelector('#textInput').value.trim();
    if (!message) { showResult('Add a message first', 'Type a message in the input box to continue.', 'NEEDS INPUT'); return; }
    if (output === 'sign') { lookupSign(message); return; }
    showResult('Translating message', 'Preparing the selected language output…', 'PROCESSING');
    try {
      const language = targetLanguage.value;
      const translated = await translateText(message, language);
      const regional = language !== 'en';
      const languageName = targetLanguage.selectedOptions[0].textContent;
      const display = regional
        ? `<div><small>English</small><br><strong>${escapeHtml(message)}</strong></div><div class="translation-result"><small>${escapeHtml(languageName)}</small><br><strong>${escapeHtml(translated.translated_text)}</strong></div><small>Automatic translation by ${escapeHtml(translated.provider)}. Review before relying on it. The text is sent to the translation provider.</small>`
        : `<strong>${escapeHtml(message)}</strong><br><small>English selected; no translation service was called.</small>`;
      const controls = output === 'text' ? '' : `<div class="speech-controls"><button id="speakButton">▶ Speak output</button><button id="stopSpeech">■ Stop</button></div>`;
      showResult(output === 'both' ? 'Text + spoken audio' : output === 'text' ? 'Translated text' : 'Spoken audio', `${display}<br><small id="speechNotice"></small>`, 'READY', controls);
      document.querySelector('#speakButton')?.addEventListener('click', () => speakText(translated.translated_text, language));
      document.querySelector('#stopSpeech')?.addEventListener('click', () => speechSynthesis.cancel());
    } catch (error) {
      showResult('Translation unavailable', `${escapeHtml(error.message)}<br><br>Check internet access or choose English.`, 'UNAVAILABLE');
    }
    return;
  }
  if (input === 'camera') {
    if (liveRecognition) { showResult('Live translation is running', 'Confirmed sign labels are being added to the transcript below the camera.', 'LIVE'); return; }
    showResult('Start the live camera', 'Choose “Live camera” above, allow camera access, then select “Start live recognition.”', 'NEEDS INPUT'); return;
  }
  if (input === 'video' || input === 'audio') {
    const file = mediaFile.files?.[0];
    if (!file) { showResult('Choose a file first', `Add a ${input} file above.`, 'NEEDS INPUT'); return; }
    if (input === 'video' && (output === 'text' || output === 'speech' || output === 'both')) { recognizeVideo(file, output); return; }
    const text = input === 'video' ? 'The clip is available for local preview. Video-to-sign is not a supported route.' : 'The audio is available for local preview. ASR is not connected; no transcript or sign output was produced.';
    showResult('Preview ready', `${escapeHtml(file.name)}<br><br>${text}`, 'PREVIEW ONLY'); return;
  }
  showResult('Speech recognition unavailable', 'Microphone capture and ASR are not connected in this prototype. No transcript or sign sequence was generated.', 'UNAVAILABLE');
});

async function recognizeVideo(file, output) {
  showResult('Analyzing clip', 'Sampling the ordered video frames and sending them to the local model…', 'PROCESSING');
  const form = new FormData(); form.append('video', file, file.name || 'camera-sign.webm');
  try {
    const response = await fetch(`${API}/api/predict`, {method:'POST', body:form});
    const payload = await response.json();
    if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail));
    const choices = (payload.alternatives || []).map((candidate, index) => `<button type="button" class="candidate-choice" data-label="${escapeHtml(candidate.label)}">${index + 1}. ${escapeHtml(candidate.label)} · ${(candidate.confidence * 100).toFixed(1)}%</button>`).join('');
    const candidatePanel = `<div class="candidate-panel"><strong>Review candidates</strong><div>${choices}</div><small>Click a label to select your reviewed text.</small></div>`;
    if (!payload.accepted) {
      showResult('Prediction needs review', `${escapeHtml(payload.message)}<br><br>Top confidence: ${(payload.confidence * 100).toFixed(1)}% · Review threshold: ${(payload.threshold * 100).toFixed(1)}% · ${payload.latency_ms.toFixed(0)} ms${candidatePanel}`);
      wireCandidateChoices(output);
      return;
    }
    await showRecognizedResult(payload.label, output, `Isolated vocabulary prediction · Confidence ${(payload.confidence * 100).toFixed(1)}% · ${payload.latency_ms.toFixed(0)} ms. ${payload.message}`, candidatePanel);
    wireCandidateChoices(output);
  } catch (error) {
    showResult('Recognition unavailable', `${escapeHtml(error.message)}<br><br>Check that the local API and trained checkpoint are running.`, 'UNAVAILABLE');
  }
}

function wireCandidateChoices(output = 'text') {
  document.querySelectorAll('.candidate-choice').forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.label || '';
    showRecognizedResult(selected, output, 'Selected from the model’s candidate labels.', '', 'USER REVIEW', 'Review selected label');
  }));
}

async function showRecognizedResult(label, output, note, candidatePanel = '', state = 'REVIEW RESULT', title = 'Recognized sign') {
  const language = targetLanguage.value;
  let translated = {translated_text:label, speech_tag:'en-US', provider:'None'};
  let translationNote = 'English selected.';
  if (language !== 'en') {
    try {
      translated = await translateText(label, language);
      translationNote = `Automatic ${escapeHtml(translated.target_language_name)} translation by ${escapeHtml(translated.provider)}; review before relying on it.`;
    } catch (error) {
      translationNote = `Translation unavailable: ${escapeHtml(error.message)}. Showing the English label.`;
    }
  }
  const spoken = translated.translated_text;
  const speechLanguage = translated.speech_tag === 'en-US' ? 'en' : language;
  const controls = `<div class="speech-controls">${output === 'text' ? '' : '<button id="speakButton">▶ Speak output</button>'}<button id="copyResult">Copy output</button></div>`;
  const body = `<div><small>English recognized label</small><br><strong id="recognizedLabel">${escapeHtml(label)}</strong></div><div class="translation-result"><small>${escapeHtml(targetLanguage.selectedOptions[0].textContent)}</small><br><strong id="translatedLabel">${escapeHtml(spoken)}</strong></div><small>${translationNote}</small><br><small>${escapeHtml(note)}</small><br><small id="speechNotice"></small>${candidatePanel}`;
  showResult(title, body, state, controls);
  document.querySelector('#speakButton')?.addEventListener('click', () => speakText(spoken, speechLanguage));
  document.querySelector('#copyResult')?.addEventListener('click', async () => navigator.clipboard.writeText(spoken));
}

function speakRecognizedLabel() {
  const label = document.querySelector('#translatedLabel')?.textContent || document.querySelector('#recognizedLabel')?.textContent || '';
  if (label) speakText(label, targetLanguage.value);
}

async function copyRecognizedLabel() {
  const label = document.querySelector('#translatedLabel')?.textContent || document.querySelector('#recognizedLabel')?.textContent || '';
  if (label) await navigator.clipboard.writeText(label);
}

async function lookupSign(text) {
  showResult('Looking up sign clip', 'Checking the reviewed dataset vocabulary…', 'SEARCHING');
  try {
    const response = await fetch(`${API}/api/sign-example?text=${encodeURIComponent(text)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : payload.detail?.message || JSON.stringify(payload.detail));
    const videoUrl = `${API}${payload.video_url}`;
    showResult('Sign video example', `<strong>${escapeHtml(payload.label)}</strong><br><br>This plays one recorded vocabulary example. It is a label lookup, not sentence-to-ISL translation.<div class="sign-output-video"><video controls playsinline src="${escapeHtml(videoUrl)}"></video></div><small>Footage: <a href="${escapeHtml(payload.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(payload.attribution)}</a></small>`, 'WORD LOOKUP');
  } catch (error) {
    showResult('No sign video available', `${escapeHtml(error.message)}<br><br>Enter one exact dataset sign label.`, 'UNAVAILABLE');
  }
}

function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
document.querySelector('#aboutBtn').addEventListener('click', () => document.querySelector('#aboutDialog').showModal());
document.querySelector('#closeDialog').addEventListener('click', () => document.querySelector('#aboutDialog').close());
document.querySelector('#aboutDialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
modeChanged();
checkBackend();
