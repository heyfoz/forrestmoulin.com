// Portfolio demonstration only. Never captures audio or sends files/API keys.
(() => {
  const byId = id => document.getElementById(id);
  const cues = [
    ['00:00', 'This is a short demonstration of tab recorder.'],
    ['00:05', 'Record a browser tab while the video plays.'],
    ['00:08', 'Speech becomes a time stamped transcript in the side panel.'],
    ['00:11', 'When the recording finishes, save the video and export the captions as a WebVTT file.'],
    ['00:17', 'Keep the meeting. And keep the words.'],
  ];
  let tick = null, seconds = 0, visible = 0;
  function render() {
    byId('placeholder').style.display = visible ? 'none' : 'flex';
    byId('captionsList').replaceChildren(...cues.slice(0, visible).map(([time, text]) => {
      const line = document.createElement('div'); line.className = 'caption-line';
      const stamp = document.createElement('div'); stamp.className = 'caption-time'; stamp.textContent = time;
      const words = document.createElement('div'); words.className = 'caption-text'; words.textContent = text;
      line.append(stamp, words); return line;
    }));
    byId('cueCount').textContent = `${visible} ${visible === 1 ? 'cue' : 'cues'}`;
    byId('btnExport').disabled = !visible;
  }
  function stop() {
    clearInterval(tick); tick = null;
    byId('btnStart').disabled = false; byId('btnStop').disabled = true;
    byId('badge').textContent = 'Ready'; byId('badge').className = 'badge';
    byId('timer').classList.remove('rec'); byId('meter').style.width = '0%';
    byId('captionStatusText').textContent = visible ? 'Sample complete' : 'Waiting for audio';
    byId('captionStatus').className = visible ? 'status ok' : 'status';
  }
  byId('btnStart').onclick = () => {
    stop(); seconds = 0; visible = 1; render();
    byId('timer').textContent = '00:00:00';
    byId('btnStart').disabled = true; byId('btnStop').disabled = false;
    byId('badge').textContent = 'Demo'; byId('badge').className = 'badge rec';
    byId('timer').classList.add('rec'); byId('captionStatusText').textContent = 'Playing sample';
    byId('captionStatus').className = 'status working';
    tick = setInterval(() => {
      seconds++; byId('timer').textContent = `00:00:${String(seconds).padStart(2, '0')}`;
      byId('meter').style.width = `${25 + (seconds * 17) % 65}%`;
      const next = [0, 5, 8, 11, 17].filter(time => seconds >= time).length;
      if (next !== visible) { visible = next; render(); byId('captionsBox').scrollTop = byId('captionsBox').scrollHeight; }
      if (seconds >= 20) stop();
    }, 1000);
  };
  byId('btnStop').textContent = 'Stop sample'; byId('btnStop').onclick = stop;
  byId('btnClear').onclick = () => { stop(); visible = 0; render(); byId('timer').textContent = '00:00:00'; byId('captionStatusText').textContent = 'Waiting for audio'; byId('captionStatus').className = 'status'; };
  byId('btnExport').onclick = () => {
    const url = URL.createObjectURL(new Blob([cues.slice(0, visible).map(c => `${c[0]}  ${c[1]}`).join('\n\n')], {type:'text/plain'}));
    const link = document.createElement('a'); link.href = url; link.download = 'tab-recorder-sample.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  document.querySelectorAll('.mode-tab').forEach(button => button.onclick = () => {
    stop();
    document.querySelectorAll('.mode-tab').forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active)); });
    byId('recordMode').classList.toggle('active', button.dataset.mode === 'record');
    byId('uploadMode').classList.toggle('active', button.dataset.mode === 'upload');
    byId('info').textContent = button.dataset.mode === 'upload' ? 'File transcription is available in the extension.' : 'Try the theme toggle or play a sample transcript.';
  });
  byId('uploadArea').onclick = () => { byId('info').textContent = 'Install the extension to choose a file. This preview does not upload files.'; };
  byId('uploadArea').ondragover = event => event.preventDefault();
  byId('uploadArea').ondrop = event => { event.preventDefault(); byId('uploadArea').click(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
