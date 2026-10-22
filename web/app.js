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

const routeMessages = {
  'video:text': 'Dynamic sign recognition is planned. You can preview a clip here; the recognition model is not connected yet.',
  'video:speech': 'The video can be previewed locally. Sign recognition and speech output are not connected yet.',
  'video:sign': 'This route is unsupported: video recognition and verified sign output assets are not available yet.',
  'video:both': 'The video can be previewed locally. Recognition and speech output are not connected yet.',
  'camera:text': 'Camera preview works locally. Live sign recognition is planned; no model is connected yet.',
  'camera:speech': 'Camera preview works locally. Recognition and speech output are not connected yet.',
  'camera:sign': 'This route is unsupported: live recognition and verified sign output assets are not available yet.',
  'camera:both': 'Camera preview works locally. Recognition and speech output are not connected yet.',
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
  'text:sign': 'This route is unsupported: sentence analysis and verified ISL sign assets are not connected yet.',
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
    mediaDescription.textContent = 'Your camera feed stays in this browser. Recognition is not connected yet.';
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
    cameraStream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
    cameraPreview.srcObject = cameraStream;
    cameraPreview.classList.remove('hidden');
    mediaTitle.textContent = 'Camera preview is live';
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
    if (output === 'sign') { showResult('Sign output unavailable', 'Text-to-ISL planning and a verified sign asset library are not connected. No sign sequence was generated.', 'UNAVAILABLE'); return; }
    if (!('speechSynthesis' in window)) { showResult('Speech is unavailable', 'This browser does not expose its built-in speech synthesis feature.', 'UNAVAILABLE'); return; }
    const speak = `<div class="speech-controls"><button id="speakButton">▶ Speak message</button><button id="stopSpeech">■ Stop</button></div>`;
    showResult(output === 'both' ? 'Text + spoken audio' : 'Spoken audio', `<strong>${escapeHtml(message)}</strong><br><br>Spoken with the selected browser voice. No translation is performed.`, 'READY', speak);
    document.querySelector('#speakButton').addEventListener('click', () => { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(message)); });
    document.querySelector('#stopSpeech').addEventListener('click', () => speechSynthesis.cancel());
    return;
  }
  if (input === 'camera') {
    showResult('Recognition model not connected', cameraStream ? 'The local camera preview is active. Dynamic ISL recognition is still planned, so no sign label or confidence score can be produced.' : 'Start the camera preview first. A dynamic ISL recognition model is not connected.', 'UNAVAILABLE'); return;
  }
  if (input === 'video' || input === 'audio') {
    const file = mediaFile.files?.[0];
    if (!file) { showResult('Choose a file first', `Add a ${input} file above.`, 'NEEDS INPUT'); return; }
    const text = input === 'video' ? 'The clip is available for local preview. Dynamic ISL recognition is not connected; no label or confidence score was produced.' : 'The audio is available for local preview. ASR is not connected; no transcript or sign output was produced.';
    showResult('Preview ready', `${escapeHtml(file.name)}<br><br>${text}`, 'PREVIEW ONLY'); return;
  }
  showResult('Speech recognition unavailable', 'Microphone capture and ASR are not connected in this prototype. No transcript or sign sequence was generated.', 'UNAVAILABLE');
});

function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
document.querySelector('#aboutBtn').addEventListener('click', () => document.querySelector('#aboutDialog').showModal());
document.querySelector('#closeDialog').addEventListener('click', () => document.querySelector('#aboutDialog').close());
document.querySelector('#aboutDialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
modeChanged();
