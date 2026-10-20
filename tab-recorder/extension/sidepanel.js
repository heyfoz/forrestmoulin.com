// =============================================
// TAB RECORDER + FILE TRANSCRIBER
// Records tabs OR transcribes uploaded audio/video
// =============================================

(function() {
  'use strict';

  const state = {
    // Recording state
    mediaRecorder: null,
    recordedChunks: [],
    stream: null,
    audioContext: null,
    analyser: null,
    scriptProcessor: null,
    websocket: null,
    isRecording: false,
    startTime: null,
    timerInterval: null,
    meterInterval: null,
    
    // Transcription state
    transcript: '',
    vttCues: [],
    currentCueStart: 0,
    
    // File upload state
    selectedFile: null,
    isProcessing: false,
    
    // Settings
    apiKey: '',
    language: 'en',
    recordingTabTitle: '',
    audioChunksSent: 0,
    currentMode: 'record'
  };

  let el = {};

  function log(msg, type = 'info') {
    const ts = new Date().toLocaleTimeString();
    const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`[${ts}] ${icon} ${msg}`);
  }

  // =============================================
  // INIT
  // =============================================

  document.addEventListener('DOMContentLoaded', () => {
    log('Initializing...');
    
    el = {
      badge: document.getElementById('badge'),
      recordingIndicator: document.getElementById('recordingIndicator'),
      recordingText: document.getElementById('recordingText'),
      instructions: document.getElementById('instructions'),
      timer: document.getElementById('timer'),
      meter: document.getElementById('meter'),
      info: document.getElementById('info'),
      btnStart: document.getElementById('btnStart'),
      btnStop: document.getElementById('btnStop'),
      btnSaveKey: document.getElementById('btnSaveKey'),
      btnClear: document.getElementById('btnClear'),
      btnExport: document.getElementById('btnExport'),
      apiKey: document.getElementById('apiKey'),
      apiStatus: document.getElementById('apiStatus'),
      langSelect: document.getElementById('langSelect'),
      captionsBox: document.getElementById('captionsBox'),
      placeholder: document.getElementById('placeholder'),
      captionsList: document.getElementById('captionsList'),
      captionStatus: document.getElementById('captionStatus'),
      captionStatusText: document.getElementById('captionStatusText'),
      cueCount: document.getElementById('cueCount'),
      // Mode tabs
      modeTabs: document.querySelectorAll('.mode-tab'),
      recordMode: document.getElementById('recordMode'),
      uploadMode: document.getElementById('uploadMode'),
      // File upload
      uploadArea: document.getElementById('uploadArea'),
      fileInput: document.getElementById('fileInput'),
      fileInfo: document.getElementById('fileInfo'),
      fileName: document.getElementById('fileName'),
      fileSize: document.getElementById('fileSize'),
      fileRemove: document.getElementById('fileRemove'),
      btnTranscribe: document.getElementById('btnTranscribe'),
      progressContainer: document.getElementById('progressContainer'),
      progressLabel: document.getElementById('progressLabel'),
      progressPercent: document.getElementById('progressPercent'),
      progressFill: document.getElementById('progressFill')
    };

    // Mode tabs
    el.modeTabs.forEach(tab => {
      tab.onclick = () => switchMode(tab.dataset.mode);
    });

    // Recording buttons
    el.btnStart.onclick = startRecording;
    el.btnStop.onclick = stopRecording;
    
    // File upload
    el.uploadArea.onclick = () => el.fileInput.click();
    el.fileInput.onchange = handleFileSelect;
    el.fileRemove.onclick = removeFile;
    el.btnTranscribe.onclick = transcribeFile;
    
    // Drag and drop
    el.uploadArea.ondragover = (e) => {
      e.preventDefault();
      el.uploadArea.classList.add('dragover');
    };
    el.uploadArea.ondragleave = () => {
      el.uploadArea.classList.remove('dragover');
    };
    el.uploadArea.ondrop = (e) => {
      e.preventDefault();
      el.uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    };
    
    // Settings
    el.btnSaveKey.onclick = saveApiKey;
    el.btnClear.onclick = clearCaptions;
    el.btnExport.onclick = exportCaptions;
    el.langSelect.onchange = (e) => {
      state.language = e.target.value;
      chrome.storage.local.set({ captionLanguage: state.language });
    };
    el.apiKey.onkeypress = (e) => { if (e.key === 'Enter') saveApiKey(); };

    loadSettings();
    
    log('Initialized', 'success');
  });

  // =============================================
  // MODE SWITCHING
  // =============================================

  function switchMode(mode) {
    state.currentMode = mode;
    
    el.modeTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
      tab.setAttribute('aria-pressed', String(tab.dataset.mode === mode));
    });
    
    el.recordMode.classList.toggle('active', mode === 'record');
    el.uploadMode.classList.toggle('active', mode === 'upload');
  }

  // =============================================
  // FILE HANDLING
  // =============================================

  function handleFileSelect(e) {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  }

  function handleFile(file) {
    // Validate file type
    const validTypes = ['audio/', 'video/', '.mp3', '.mp4', '.wav', '.webm', '.m4a', '.ogg', '.flac'];
    const isValid = validTypes.some(type => 
      file.type.startsWith(type) || file.name.toLowerCase().endsWith(type)
    );
    
    if (!isValid) {
      el.info.textContent = 'Invalid file type. Use audio/video files.';
      el.info.className = 'info error';
      return;
    }
    
    // Validate file size (500MB max)
    if (file.size > 500 * 1024 * 1024) {
      el.info.textContent = 'File too large. Max 500MB.';
      el.info.className = 'info error';
      return;
    }
    
    state.selectedFile = file;
    
    // Update UI
    el.fileName.textContent = file.name;
    el.fileSize.textContent = formatFileSize(file.size);
    el.fileInfo.classList.add('show');
    el.uploadArea.classList.add('has-file');
    el.btnTranscribe.disabled = !state.apiKey;
    
    // Set icon based on type
    const icon = file.type.startsWith('video/') ? '🎬' : '🎵';
    el.fileInfo.querySelector('.file-icon').textContent = icon;
    
    log('File selected: ' + file.name, 'success');
  }

  function removeFile() {
    state.selectedFile = null;
    el.fileInput.value = '';
    el.fileInfo.classList.remove('show');
    el.uploadArea.classList.remove('has-file');
    el.btnTranscribe.disabled = true;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // =============================================
  // FILE TRANSCRIPTION
  // =============================================

  async function transcribeFile() {
    if (!state.selectedFile || !state.apiKey) return;
    
    log('Starting file transcription...');
    state.isProcessing = true;
    
    // Update UI
    el.btnTranscribe.disabled = true;
    el.badge.textContent = 'Processing';
    el.badge.className = 'badge processing';
    el.recordingIndicator.className = 'recording-indicator processing show';
    el.recordingText.textContent = 'Transcribing: ' + state.selectedFile.name.substring(0, 25);
    el.progressContainer.classList.add('show');
    el.progressLabel.textContent = 'Uploading to Deepgram...';
    el.progressPercent.textContent = '0%';
    el.progressFill.style.width = '0%';
    el.captionStatusText.textContent = 'Processing...';
    el.captionStatus.className = 'status working';
    
    clearCaptions();

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('audio', state.selectedFile);
      
      // Build URL with params
      const params = new URLSearchParams({
        model: 'nova-2',
        language: state.language,
        punctuate: 'true',
        utterances: 'true',
        smart_format: 'true'
      });
      
      const url = `https://api.deepgram.com/v1/listen?${params}`;
      
      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 50);
          el.progressPercent.textContent = percent + '%';
          el.progressFill.style.width = percent + '%';
        }
      };
      
      xhr.onload = () => {
        el.progressPercent.textContent = '100%';
        el.progressFill.style.width = '100%';
        el.progressLabel.textContent = 'Processing response...';
        
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            handleTranscriptionResponse(response);
          } catch (e) {
            throw new Error('Invalid response from Deepgram');
          }
        } else {
          let errorMsg = 'Transcription failed';
          try {
            const errData = JSON.parse(xhr.responseText);
            errorMsg = errData.err_msg || errData.error || errorMsg;
          } catch (e) {}
          throw new Error(errorMsg);
        }
      };
      
      xhr.onerror = () => {
        throw new Error('Network error');
      };
      
      xhr.open('POST', url);
      xhr.setRequestHeader('Authorization', `Token ${state.apiKey}`);
      
      el.progressLabel.textContent = 'Uploading...';
      xhr.send(state.selectedFile);
      
      // Wait for completion
      await new Promise((resolve, reject) => {
        xhr.onloadend = resolve;
        xhr.onerror = reject;
      });
      
    } catch (err) {
      log('Transcription error: ' + err.message, 'error');
      el.info.textContent = 'Error: ' + err.message;
      el.info.className = 'info error';
      el.captionStatusText.textContent = 'Failed';
      el.captionStatus.className = 'status error';
    } finally {
      state.isProcessing = false;
      el.btnTranscribe.disabled = false;
      el.badge.textContent = 'Ready';
      el.badge.className = 'badge';
      el.recordingIndicator.className = 'recording-indicator';
      el.progressContainer.classList.remove('show');
    }
  }

  function handleTranscriptionResponse(response) {
    log('Processing transcription response...');
    
    const results = response.results;
    if (!results) {
      throw new Error('No results in response');
    }
    
    // Get utterances (with timestamps) or fall back to channels
    const utterances = results.utterances || [];
    const channels = results.channels || [];
    
    if (utterances.length > 0) {
      // Use utterances for better timing
      utterances.forEach((utt, i) => {
        const startMs = Math.round(utt.start * 1000);
        const endMs = Math.round(utt.end * 1000);
        const text = utt.transcript;
        
        if (text && text.trim()) {
          state.vttCues.push({
            start: startMs,
            end: endMs,
            text: text.trim()
          });
          state.transcript += text + ' ';
        }
      });
    } else if (channels.length > 0 && channels[0].alternatives) {
      // Fall back to alternatives with word timestamps
      const alt = channels[0].alternatives[0];
      const words = alt.words || [];
      
      if (words.length > 0) {
        // Group words into ~5 second segments
        let segmentStart = 0;
        let segmentWords = [];
        
        words.forEach((word, i) => {
          if (segmentWords.length === 0) {
            segmentStart = Math.round(word.start * 1000);
          }
          
          segmentWords.push(word.word);
          
          const wordEnd = Math.round(word.end * 1000);
          const segmentDuration = wordEnd - segmentStart;
          
          // Create segment every ~5 seconds or at punctuation
          const isPunctuation = word.word.match(/[.!?]$/);
          const isLongEnough = segmentDuration >= 5000;
          const isLast = i === words.length - 1;
          
          if (isPunctuation || isLongEnough || isLast) {
            const text = segmentWords.join(' ');
            state.vttCues.push({
              start: segmentStart,
              end: wordEnd,
              text: text
            });
            state.transcript += text + ' ';
            segmentWords = [];
          }
        });
      } else if (alt.transcript) {
        // No word timestamps, just full transcript
        state.vttCues.push({
          start: 0,
          end: 0,
          text: alt.transcript
        });
        state.transcript = alt.transcript;
      }
    }
    
    // Update UI
    renderCaptions();
    
    el.info.textContent = '✅ Transcription complete!';
    el.info.className = 'info active';
    el.captionStatusText.textContent = 'Complete';
    el.captionStatus.className = 'status ok';
    el.btnExport.disabled = state.vttCues.length === 0;
    
    log(`Transcription complete: ${state.vttCues.length} segments`, 'success');
  }

  // =============================================
  // SETTINGS
  // =============================================

  function loadSettings() {
    chrome.storage.local.get(['deepgramApiKey', 'captionLanguage'], (result) => {
      if (result.deepgramApiKey) {
        state.apiKey = result.deepgramApiKey;
        el.apiKey.value = result.deepgramApiKey;
        validateApiKey(result.deepgramApiKey);
      }
      if (!result.deepgramApiKey) document.getElementById('settingsPanel').open = true;
      if (result.captionLanguage) {
        state.language = result.captionLanguage;
        el.langSelect.value = result.captionLanguage;
      }
    });
  }

  function saveApiKey() {
    const key = el.apiKey.value.trim();
    if (!key) {
      showApiStatus('❌ Please enter an API key', 'invalid');
      return;
    }
    showApiStatus('⏳ Validating...', 'checking');
    validateApiKey(key);
  }

  async function validateApiKey(key) {
    try {
      const response = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { 'Authorization': `Token ${key}` }
      });

      if (response.ok) {
        state.apiKey = key;
        chrome.storage.local.set({ deepgramApiKey: key, captionLanguage: state.language });
        showApiStatus('✅ API key valid!', 'valid');
        el.btnStart.disabled = false;
        el.btnTranscribe.disabled = !state.selectedFile;
        el.info.textContent = 'Ready!';
        el.info.className = 'info active';
        el.captionStatusText.textContent = 'Ready';
        el.captionStatus.className = 'status ok';
        log('API key validated', 'success');
      } else {
        showApiStatus('❌ Invalid API key', 'invalid');
        el.btnStart.disabled = true;
        el.btnTranscribe.disabled = true;
      }
    } catch (err) {
      log('Validation error: ' + err.message, 'error');
      showApiStatus('❌ Error: ' + err.message, 'invalid');
    }
  }

  function showApiStatus(text, type) {
    el.apiStatus.textContent = text;
    el.apiStatus.className = 'api-status ' + type;
  }

  // =============================================
  // CAPTIONS
  // =============================================

  function renderCaptions() {
    if (state.vttCues.length === 0) {
      el.placeholder.style.display = 'flex';
      el.captionsList.innerHTML = '';
      return;
    }
    
    el.placeholder.style.display = 'none';
    el.captionsList.innerHTML = state.vttCues.map(cue => `
      <div class="caption-line">
        <div class="caption-time">${formatTimestamp(cue.start)} → ${formatTimestamp(cue.end)}</div>
        <div class="caption-text">${escapeHtml(cue.text)}</div>
      </div>
    `).join('');
    
    el.cueCount.textContent = state.vttCues.length + ' cues';
    el.captionsBox.scrollTop = el.captionsBox.scrollHeight;
    el.btnExport.disabled = false;
  }

  function addCaption(text, startMs, endMs) {
    if (!text || !text.trim()) return;
    
    state.vttCues.push({
      start: startMs,
      end: endMs,
      text: text.trim()
    });
    state.transcript += text + ' ';
    
    renderCaptions();
  }

  function clearCaptions() {
    state.transcript = '';
    state.vttCues = [];
    el.captionsList.innerHTML = '';
    el.placeholder.style.display = 'flex';
    el.cueCount.textContent = '0 cues';
    el.btnExport.disabled = true;
  }

  function exportCaptions() {
    if (state.vttCues.length === 0) return;
    
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const baseName = state.recordingTabTitle || state.selectedFile?.name?.replace(/\.[^.]+$/, '') || 'captions';
    const safeName = baseName.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    
    // Export WebVTT
    const vtt = generateWebVTT();
    download(new Blob([vtt], { type: 'text/vtt' }), `${safeName}-${ts}.vtt`);
    
    // Export transcript
    if (state.transcript.trim()) {
      setTimeout(() => {
        download(new Blob([state.transcript.trim()], { type: 'text/plain' }), `${safeName}-${ts}.txt`);
      }, 300);
    }
    
    log('Captions exported', 'success');
  }

  // =============================================
  // UTILITIES
  // =============================================

  function formatTime(ms) {
    const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
    const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function formatTimestamp(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const ms2 = Math.floor((ms % 1000) / 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms2.toString().padStart(2, '0')}`;
  }

  function formatVTTTime(ms) {
    const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
    const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    const ms2 = (ms % 1000).toString().padStart(3, '0');
    return `${h}:${m}:${s}.${ms2}`;
  }

  function generateWebVTT() {
    let vtt = 'WEBVTT\n\n';
    state.vttCues.forEach((cue, i) => {
      vtt += `${i + 1}\n`;
      vtt += `${formatVTTTime(cue.start)} --> ${formatVTTTime(cue.end)}\n`;
      vtt += `${cue.text}\n\n`;
    });
    return vtt;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateTimer() {
    if (!state.startTime) return;
    el.timer.textContent = formatTime(Date.now() - state.startTime);
  }

  function updateMeter() {
    if (!state.analyser || !state.isRecording) {
      el.meter.style.width = '0%';
      return;
    }
    const data = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b) / data.length;
    const pct = Math.min(100, (avg / 255) * 100);
    el.meter.style.width = pct + '%';
    el.meter.className = 'meter-bar' + (pct > 70 ? ' high' : pct > 40 ? ' med' : '');
  }

  function updateUI(recording) {
    el.btnStart.disabled = recording || !state.apiKey;
    el.btnStop.disabled = !recording;
    el.langSelect.disabled = recording;
    el.apiKey.disabled = recording;
    el.btnSaveKey.disabled = recording;
    el.badge.textContent = recording ? 'REC' : 'Ready';
    el.badge.className = 'badge' + (recording ? ' rec' : '');
    el.timer.className = 'timer' + (recording ? ' rec' : '');
    el.recordingIndicator.className = 'recording-indicator' + (recording ? ' show' : '');
    el.instructions.style.display = recording ? 'none' : 'block';
    
    // Disable mode switching while recording
    el.modeTabs.forEach(tab => {
      tab.disabled = recording;
      tab.style.opacity = recording ? '0.5' : '1';
      tab.style.pointerEvents = recording ? 'none' : 'auto';
    });
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // =============================================
  // DEEPGRAM WEBSOCKET (for live recording)
  // =============================================

  function connectDeepgram() {
    return new Promise((resolve, reject) => {
      log('Connecting to Deepgram...');
      
      const params = new URLSearchParams({
        model: 'nova-2',
        language: state.language,
        punctuate: 'true',
        interim_results: 'false',
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1'
      });
      
      const url = `wss://api.deepgram.com/v1/listen?${params}`;
      
      try {
        state.websocket = new WebSocket(url, ['token', state.apiKey]);
      } catch (err) {
        reject(err);
        return;
      }

      const timeout = setTimeout(() => {
        if (state.websocket?.readyState === WebSocket.CONNECTING) {
          state.websocket.close();
          reject(new Error('Connection timeout'));
        }
      }, 15000);

      state.websocket.onopen = () => {
        clearTimeout(timeout);
        log('Deepgram connected!', 'success');
        el.captionStatus.className = 'status working';
        el.captionStatusText.textContent = 'Listening...';
        resolve();
      };

      state.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.channel?.alternatives?.[0]?.transcript) {
            const text = data.channel.alternatives[0].transcript;
            if (text) {
              const endTime = Date.now() - state.startTime;
              addCaption(text, state.currentCueStart, endTime);
              state.currentCueStart = endTime;
              log('Caption: ' + text.substring(0, 50), 'success');
            }
          }
        } catch (e) {
          log('Parse error: ' + e.message, 'error');
        }
      };

      state.websocket.onerror = () => {
        clearTimeout(timeout);
        el.captionStatus.className = 'status error';
        el.captionStatusText.textContent = 'Connection error';
        reject(new Error('WebSocket error'));
      };

      state.websocket.onclose = (e) => {
        clearTimeout(timeout);
        log(`WebSocket closed: ${e.code}`);
        if (e.code === 1008) {
          el.captionStatusText.textContent = 'Auth failed';
        } else if (state.isRecording) {
          el.captionStatusText.textContent = 'Reconnecting...';
          setTimeout(() => {
            if (state.isRecording) connectDeepgram().catch(() => {});
          }, 2000);
        }
      };
    });
  }

  // =============================================
  // AUDIO PROCESSING
  // =============================================

  function setupAudioProcessing(stream) {
    log('Setting up audio...');
    
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      log('No audio tracks!', 'error');
      return false;
    }

    try {
      state.audioContext = new AudioContext();
      const source = state.audioContext.createMediaStreamSource(stream);
      
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 256;
      source.connect(state.analyser);

      const bufferSize = 4096;
      state.scriptProcessor = state.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      const targetRate = 16000;
      const sourceRate = state.audioContext.sampleRate;
      const ratio = sourceRate / targetRate;
      
      log(`Audio: ${sourceRate}Hz -> ${targetRate}Hz`);

      state.scriptProcessor.onaudioprocess = (e) => {
        if (!state.isRecording || !state.websocket || state.websocket.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const input = e.inputBuffer.getChannelData(0);
        const outputLen = Math.floor(input.length / ratio);
        const int16 = new Int16Array(outputLen);
        
        for (let i = 0; i < outputLen; i++) {
          const srcIdx = Math.floor(i * ratio);
          const s = Math.max(-1, Math.min(1, input[srcIdx]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        state.websocket.send(int16.buffer);
        state.audioChunksSent++;
      };

      source.connect(state.scriptProcessor);
      state.scriptProcessor.connect(state.audioContext.destination);
      
      state.meterInterval = setInterval(updateMeter, 100);
      
      log('Audio setup complete', 'success');
      return true;
    } catch (err) {
      log('Audio setup error: ' + err.message, 'error');
      return false;
    }
  }

  // =============================================
  // RECORDING
  // =============================================

  async function startRecording() {
    log('========== START RECORDING ==========');
    
    if (!state.apiKey) {
      el.info.textContent = 'Enter API key first';
      el.info.className = 'info error';
      return;
    }

    state.audioChunksSent = 0;
    state.recordingTabTitle = '';

    try {
      el.info.textContent = 'Select a tab in the popup...';
      el.info.className = 'info';
      el.captionStatusText.textContent = 'Waiting for selection...';

      state.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          cursor: 'always'
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: false
        },
        preferCurrentTab: false,
        selfBrowserSurface: 'include',
        systemAudio: 'include',
        surfaceSwitching: 'exclude',
        monitorTypeSurfaces: 'exclude'
      });

      log('Got media stream!', 'success');

      const videoTrack = state.stream.getVideoTracks()[0];
      if (videoTrack) {
        state.recordingTabTitle = videoTrack.label || 'Recording';
        log('Recording: ' + state.recordingTabTitle);
      }

      const audioTracks = state.stream.getAudioTracks();
      const videoTracks = state.stream.getVideoTracks();
      
      log(`Tracks: ${videoTracks.length} video, ${audioTracks.length} audio`);

      if (audioTracks.length === 0) {
        el.info.textContent = '⚠️ No audio! Check "Share tab audio"';
        el.info.className = 'info warn';
        el.captionStatusText.textContent = 'No audio - captions unavailable';
        el.captionStatus.className = 'status error';
      } else {
        el.info.textContent = '🔊 Recording: ' + state.recordingTabTitle.substring(0, 35);
        el.info.className = 'info active';
        el.recordingText.textContent = 'Recording: ' + state.recordingTabTitle.substring(0, 30);
        
        try {
          await connectDeepgram();
          setupAudioProcessing(state.stream);
        } catch (err) {
          log('Deepgram failed: ' + err.message, 'error');
          el.captionStatusText.textContent = 'Captions unavailable';
          el.captionStatus.className = 'status error';
        }
      }

      // Setup MediaRecorder
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      
      state.mediaRecorder = new MediaRecorder(state.stream, { mimeType: mime });
      state.recordedChunks = [];

      state.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) state.recordedChunks.push(e.data);
      };

      state.mediaRecorder.onstop = saveRecording;

      state.mediaRecorder.start(1000);
      state.isRecording = true;
      state.startTime = Date.now();
      state.currentCueStart = 0;
      state.timerInterval = setInterval(updateTimer, 1000);

      clearCaptions();
      updateUI(true);

      state.stream.getVideoTracks()[0].onended = () => {
        log('User stopped sharing');
        stopRecording();
      };

      log('Recording started!', 'success');

    } catch (err) {
      log('Error: ' + err.message, 'error');
      
      if (err.name === 'NotAllowedError') {
        el.info.textContent = 'Cancelled - no tab selected';
      } else {
        el.info.textContent = 'Error: ' + err.message;
      }
      el.info.className = 'info error';
      cleanup();
    }
  }

  function stopRecording() {
    if (!state.isRecording) return;
    
    log('========== STOP RECORDING ==========');
    log(`Stats: audioChunks=${state.audioChunksSent}, cues=${state.vttCues.length}`);
    
    state.isRecording = false;
    
    el.info.textContent = 'Saving...';
    el.captionStatusText.textContent = 'Finalizing...';

    if (state.mediaRecorder?.state !== 'inactive') {
      state.mediaRecorder.stop();
    } else {
      saveRecording();
    }

    cleanup();
  }

  function cleanup() {
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
    }
    
    if (state.scriptProcessor) {
      state.scriptProcessor.disconnect();
      state.scriptProcessor = null;
    }
    
    if (state.audioContext) {
      state.audioContext.close();
      state.audioContext = null;
      state.analyser = null;
    }
    
    if (state.websocket) {
      if (state.websocket.readyState === WebSocket.OPEN) {
        try { state.websocket.send(JSON.stringify({ type: 'CloseStream' })); } catch (e) {}
      }
      state.websocket.close();
      state.websocket = null;
    }
    
    clearInterval(state.timerInterval);
    clearInterval(state.meterInterval);
    
    updateUI(false);
    el.meter.style.width = '0%';
  }

  function saveRecording() {
    log('Saving...');
    
    if (state.recordedChunks.length === 0) {
      el.info.textContent = 'No data recorded';
      el.info.className = 'info error';
      return;
    }

    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const safeName = state.recordingTabTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 30) || 'recording';

    // Video
    const videoBlob = new Blob(state.recordedChunks, { 
      type: state.mediaRecorder?.mimeType || 'video/webm' 
    });
    log(`Video size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
    download(videoBlob, `${safeName}-${ts}.webm`);

    // WebVTT
    if (state.vttCues.length > 0) {
      log(`Saving ${state.vttCues.length} captions`);
      setTimeout(() => {
        const vtt = generateWebVTT();
        download(new Blob([vtt], { type: 'text/vtt' }), `${safeName}-${ts}.vtt`);
      }, 500);
    }

    // Transcript
    if (state.transcript.trim()) {
      setTimeout(() => {
        download(new Blob([state.transcript.trim()], { type: 'text/plain' }), `${safeName}-${ts}.txt`);
      }, 1000);
    }

    state.recordedChunks = [];
    
    el.info.textContent = '✅ Saved!';
    el.info.className = 'info active';
    el.captionStatusText.textContent = 'Complete';
    el.captionStatus.className = 'status ok';
    
    log('Saved!', 'success');
  }

})();