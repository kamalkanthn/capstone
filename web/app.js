const inputMode = document.querySelector('#inputMode');
const outputMode = document.querySelector('#outputMode');
const routeNote = document.querySelector('#routeNote span:nth-child(2)');
const textPanel = document.querySelector('#textPanel');
const mediaPanel = document.querySelector('#mediaPanel');
const mediaFile = document.querySelector('#mediaFile');
const mediaTitle = document.querySelector('#mediaTitle');
const mediaDescription = document.querySelector('#mediaDescription');
const uploadLabel = document.querySelector('#uploadLabel');
const cameraButton = document.querySelector('#cameraButton');
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

const API = 'http://127.0.0.1:4174';

async function checkBackend() {
  const badge = document.querySelector('#backendStatus');
  const cardState = document.querySelector('#recognizerState');
  try {
    const response = await fetch(`${API}/api/health`);
    const health = await response.json();
    badge.innerHTML = `<i></i> ${health.model_available ? 'Model ready' : 'Model setup needed'}`;
    cardState.textContent = health.model_available ? `ISOLATED ${health.vocabulary_size}-SIGN MODEL` : 'MODEL NOT TRAINED YET';
    cardState.className = `cap-status ${health.model_available ? 'available' : 'planned'}`;
    if (!health.model_available) routeNote.textContent = 'Video can be sampled; train the local isolated-sign model to enable label and confidence predictions.';
  } catch {
    badge.innerHTML = '<i></i> API offline';
    cardState.textContent = 'API OFFLINE';
  }
}

const routeMessages = {
  'video:text': 'Upload a short clip of one isolated sign. The local model returns its vocabulary label after training.',
  'video:speech': 'Upload a short isolated sign clip. The local model can speak the recognized vocabulary label after training.',
  'video:sign': 'This route is unsupported: video recognition and verified sign output assets are not available yet.',
  'video:both': 'Upload one isolated sign. The local model returns its label and can speak it when a checkpoint is available.',
  'camera:text': 'Record one isolated sign clip. Recognition runs when you prepare the output, after model training.',
  'camera:speech': 'Record one isolated sign clip. The model can speak its predicted vocabulary label after training.',
  'camera:sign': 'This route is unsupported: live recognition and verified sign output assets are not available yet.',
  'camera:both': 'Record one isolated sign. The local model returns and can speak its label when a checkpoint is available.',
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
  uploadLabel.classList.toggle('hidden', input === 'camera' || input === 'microphone');
  if (input === 'camera') {
    mediaTitle.textContent = 'Start a local camera preview';
    mediaDescription.textContent = 'Your camera feed stays in this browser. Record one isolated sign clip, then submit it to the local model.';
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
      cameraButton.textContent = 'Record sign clip';
      return;
    }
    if (recorder?.state === 'recording') {
      recorder.stop(); cameraButton.textContent = 'Finishing clip…'; return;
    }
    audioChunks = [];
    recorder = new MediaRecorder(cameraStream);
    recorder.addEventListener('dataavailable', event => { if (event.data.size) audioChunks.push(event.data); });
    recorder.addEventListener('stop', () => {
      const stream = cameraStream;
      stream?.getTracks().forEach(track => track.stop()); cameraStream = null;
      const blob = new Blob(audioChunks, {type: recorder.mimeType || 'video/webm'});
      cameraVideoFile = new File([blob], 'camera-sign.webm', {type: blob.type});
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      mediaUrl = URL.createObjectURL(blob);
      cameraPreview.srcObject = null; cameraPreview.classList.add('hidden');
      videoPreview.src = mediaUrl; videoPreview.classList.remove('hidden'); previewWrap.classList.remove('hidden');
      mediaTitle.textContent = 'Recorded clip ready';
      cameraButton.textContent = 'Record again';
    }, {once: true});
    recorder.start(); cameraButton.textContent = 'Stop recording'; mediaTitle.textContent = 'Recording your sign…';
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
outputMode.addEventListener('change', modeChanged);

function showResult(title, body, state = 'READY', actions = '') {
  document.querySelector('#resultTitle').textContent = title;
  document.querySelector('#resultState').textContent = state;
  resultContent.innerHTML = body + actions;
  resultCard.classList.remove('hidden');
  resultCard.scrollIntoView({behavior:'smooth', block:'nearest'});
}

document.querySelector('#runButton').addEventListener('click', () => {
  const input = inputMode.value, output = outputMode.value;
  if (input === 'text') {
    const message = document.querySelector('#textInput').value.trim();
    if (!message) { showResult('Add a message first', 'Type a message in the input box to continue.', 'NEEDS INPUT'); return; }
    if (output === 'text') { showResult('Text output', `<strong>${escapeHtml(message)}</strong><br><br>This output displays your original text; it does not translate it.`); return; }
    if (output === 'sign') { lookupSign(message); return; }
    if (!('speechSynthesis' in window)) { showResult('Speech is unavailable', 'This browser does not expose its built-in speech synthesis feature.', 'UNAVAILABLE'); return; }
    const speak = `<div class="speech-controls"><button id="speakButton">▶ Speak message</button><button id="stopSpeech">■ Stop</button></div>`;
    showResult(output === 'both' ? 'Text + spoken audio' : 'Spoken audio', `<strong>${escapeHtml(message)}</strong><br><br>Spoken with the selected browser voice. No translation is performed.`, 'READY', speak);
    document.querySelector('#speakButton').addEventListener('click', () => { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(message)); });
    document.querySelector('#stopSpeech').addEventListener('click', () => speechSynthesis.cancel());
    return;
  }
  if (input === 'camera') {
    if (cameraStream) { showResult('Finish recording first', 'Stop the camera recording, then prepare the recorded clip.', 'NEEDS INPUT'); return; }
    if (cameraVideoFile) { recognizeVideo(cameraVideoFile, output); return; }
    showResult('Record a sign clip first', 'Enable the camera and record an isolated sign clip. Recognition runs once after you choose Prepare output.', 'NEEDS INPUT'); return;
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
    if (!payload.accepted) {
      showResult('Prediction needs review', `${escapeHtml(payload.message)}<br><br>Top confidence: ${(payload.confidence * 100).toFixed(1)}% · Rejection threshold: ${(payload.threshold * 100).toFixed(1)}% · ${payload.latency_ms.toFixed(0)} ms`, 'LOW CONFIDENCE');
      return;
    }
    const label = payload.label;
    const speakControl = `<div class="speech-controls"><button id="speakButton">▶ Speak sign label</button><button id="copyResult">Copy text</button></div>`;
    showResult('Recognized sign', `<strong>${escapeHtml(label)}</strong><br><br>Isolated vocabulary prediction · Confidence ${(payload.confidence * 100).toFixed(1)}% · ${payload.latency_ms.toFixed(0)} ms<br><small>${escapeHtml(payload.message)}</small>`, 'REVIEW RESULT', output === 'text' ? '' : speakControl);
    if (output !== 'text') document.querySelector('#speakButton').addEventListener('click', () => { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(label)); });
    document.querySelector('#copyResult')?.addEventListener('click', async () => navigator.clipboard.writeText(label));
  } catch (error) {
    showResult('Recognition unavailable', `${escapeHtml(error.message)}<br><br>Check that the local API and trained checkpoint are running.`, 'UNAVAILABLE');
  }
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
