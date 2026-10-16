var express = require('express');
var yts = require('yt-search');
var ytdl = require('ytdl-core');

var app = express();
var PORT = process.env.PORT || 3000;

function fmt(d) { var m = Math.floor(d / 60), s = d % 60; return m + ':' + (s < 10 ? '0' : '') + s; }

// Search YouTube
app.get('/api/search', async function(req, res) {
  try {
    var q = (req.query.q || '').trim();
    if (!q) return res.json({ ok: true, results: [] });
    var r = await yts(q);
    var vids = (r.videos || []).slice(0, 20).map(function(v) {
      return {
        id: v.videoId,
        title: v.title,
        author: v.author ? v.author.name : '',
        duration: v.seconds || 0,
        durationStr: v.timestamp || '',
        thumb: v.thumbnail || '',
        views: v.views || 0,
        ago: v.ago || ''
      };
    });
    res.json({ ok: true, results: vids });
  } catch (e) {
    console.log('[search] error:', e.message);
    res.json({ ok: false, error: e.message, results: [] });
  }
});

// Get video info + download URLs
app.get('/api/info', async function(req, res) {
  try {
    var id = (req.query.id || '').trim();
    if (!id) return res.json({ ok: false, error: 'no id' });
    if (!ytdl.validateID(id)) return res.json({ ok: false, error: 'invalid id' });

    var info = await ytdl.getInfo(id);
    var title = info.videoDetails.title || '';
    var author = info.videoDetails.author ? info.videoDetails.author.name : '';
    var duration = parseInt(info.videoDetails.lengthSeconds) || 0;
    var thumb = info.videoDetails.thumbnails && info.videoDetails.thumbnails.length
      ? info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url : '';

    // Video+Audio formats (muxed mp4)
    var muxed = info.formats
      .filter(function(f) { return f.hasVideo && f.hasAudio && f.container === 'mp4'; })
      .map(function(f) {
        return {
          quality: f.qualityLabel || f.quality || 'MP4',
          url: f.url,
          size: f.contentLength ? (parseInt(f.contentLength) / 1048576).toFixed(1) + ' MB' : '',
          width: f.width,
          height: f.height,
          itag: f.itag
        };
      })
      .sort(function(a, b) { return (b.height || 0) - (a.height || 0); });

    // Video-only formats (higher quality, no audio)
    var videoOnly = info.formats
      .filter(function(f) { return f.hasVideo && !f.hasAudio && f.container === 'mp4'; })
      .map(function(f) {
        return {
          quality: (f.qualityLabel || f.quality || '') + ' (video only)',
          url: f.url,
          size: f.contentLength ? (parseInt(f.contentLength) / 1048576).toFixed(1) + ' MB' : '',
          width: f.width,
          height: f.height,
          itag: f.itag
        };
      })
      .sort(function(a, b) { return (b.height || 0) - (a.height || 0); });

    // Audio-only formats
    var audio = info.formats
      .filter(function(f) { return f.hasAudio && !f.hasVideo; })
      .map(function(f) {
        return {
          quality: 'MP3 ' + (f.audioBitrate ? f.audioBitrate + 'kbps' : ''),
          url: f.url,
          size: f.contentLength ? (parseInt(f.contentLength) / 1048576).toFixed(1) + ' MB' : '',
          bitrate: f.audioBitrate || 0,
          itag: f.itag
        };
      })
      .sort(function(a, b) { return (b.bitrate || 0) - (a.bitrate || 0); });

    res.json({
      ok: true,
      info: {
        id: id,
        title: title,
        author: author,
        duration: duration,
        thumb: thumb,
        muxed: muxed,
        videoOnly: videoOnly,
        audio: audio
      }
    });
  } catch (e) {
    console.log('[info] error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

var HTML = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Tubidy Search - Free Music & Video Download</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0a0a0a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.5;min-height:100vh}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:#1a1a1a}
::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
.container{max-width:720px;margin:0 auto;padding:16px}
.logo{text-align:center;padding:32px 0 8px}
.logo h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,#ff6b6b,#ee5a24,#f0932b,#ffbe76);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.logo p{color:#666;font-size:13px;margin-top:4px}
.search-box{position:relative;margin:20px 0 24px}
.search-box input{width:100%;height:52px;background:#1a1a1a;border:2px solid #2a2a2a;border-radius:28px;padding:0 110px 0 48px;color:#fff;font-size:15px;outline:0;transition:border-color .2s;font-family:inherit}
.search-box input:focus{border-color:#ee5a24}
.search-box input::placeholder{color:#555}
.search-icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:20px;height:20px;fill:none;stroke:#555;stroke-width:2}
.search-btn{position:absolute;right:4px;top:4px;height:44px;padding:0 24px;background:linear-gradient(135deg,#ee5a24,#f0932b);color:#fff;border:0;border-radius:24px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .2s}
.search-btn:hover{opacity:0.9}
.search-btn:active{transform:scale(0.97)}
.hot{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:24px}
.hot span{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;padding:4px 14px;font-size:12px;color:#888;cursor:pointer;transition:all .2s}
.hot span:hover{border-color:#ee5a24;color:#ee5a24}
.results{display:flex;flex-direction:column;gap:2px}
.result{display:flex;gap:12px;padding:12px 14px;background:#111;border-radius:12px;cursor:pointer;transition:background .15s;position:relative}
.result:hover{background:#1a1a1a}
.result:active{background:#222}
.result-thumb{position:relative;width:120px;height:68px;border-radius:8px;overflow:hidden;flex-shrink:0;background:#1a1a1a}
.result-thumb img{width:100%;height:100%;object-fit:cover}
.result-thumb .dur{position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.8);color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;font-weight:500}
.result-info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
.result-title{font-size:14px;font-weight:500;color:#e0e0e0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4}
.result-meta{font-size:12px;color:#666;display:flex;gap:12px;align-items:center}
.loading{text-align:center;padding:60px 0;color:#555}
.loading .spinner{width:32px;height:32px;border:3px solid #222;border-top-color:#ee5a24;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:80px 0;color:#444}
.empty p{font-size:14px;color:#555}
.overlay{position:fixed;inset:0;background:rgba(6,6,6,0.95);z-index:100;display:none;flex-direction:column}
.overlay.open{display:flex}
.overlay-bar{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#0a0a0a;border-bottom:1px solid #1a1a1a;flex-shrink:0}
.overlay-close{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#1a1a1a;border:0;border-radius:50%;color:#888;font-size:20px;cursor:pointer;transition:all .2s}
.overlay-close:hover{background:#2a2a2a;color:#fff}
.overlay-title{flex:1;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.overlay-body{flex:1;overflow-y:auto;padding:16px}
.dl-header{display:flex;gap:16px;margin-bottom:20px}
.dl-thumb{width:160px;height:90px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#1a1a1a}
.dl-thumb img{width:100%;height:100%;object-fit:cover}
.dl-info h2{font-size:16px;font-weight:700;margin-bottom:6px;line-height:1.3}
.dl-info p{color:#666;font-size:12px}
.section-label{font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid #1a1a1a}
.dl-item{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#141414;border-radius:12px;margin-bottom:6px;cursor:pointer;transition:all .2s;border:1px solid transparent}
.dl-item:hover{background:#1a1a1a;border-color:#2a2a2a}
.dl-item:active{transform:scale(0.99)}
.dl-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px}
.dl-icon.video{background:linear-gradient(135deg,#ee5a24,#f0932b);color:#fff}
.dl-icon.audio{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff}
.dl-icon svg{width:20px;height:20px;fill:#fff}
.dl-detail{flex:1;min-width:0}
.dl-format{font-size:13px;font-weight:600;color:#e0e0e0}
.dl-size{font-size:11px;color:#666;margin-top:2px}
.dl-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:0;transition:opacity .2s;font-family:inherit;flex-shrink:0}
.dl-btn.video{background:linear-gradient(135deg,#ee5a24,#f0932b);color:#fff}
.dl-btn.audio{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff}
.dl-btn:hover{opacity:0.85}
.toast{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);background:#ee5a24;color:#fff;padding:10px 24px;border-radius:24px;font-size:13px;font-weight:600;z-index:200;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap}
.footer{text-align:center;padding:20px;color:#333;font-size:11px}
.error-box{background:#1a0a0a;border:1px solid #3a1515;border-radius:12px;padding:16px;color:#ff6b6b;font-size:13px;margin:16px 0}
@media(max-width:600px){
  .result-thumb{width:100px;height:56px}
  .result-title{font-size:13px}
  .dl-header{flex-direction:column;gap:10px}
  .dl-thumb{width:100%;height:160px}
}
</style>
</head><body>
<div class="container">
  <div class="logo">
    <h1>♫ Tubidy Search</h1>
    <p>Search & download music and videos from YouTube</p>
  </div>
  <div class="search-box">
    <svg class="search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
    <input type="text" id="sInput" placeholder="Search for songs, artists, videos..." autocomplete="off">
    <button class="search-btn" id="sBtn">Search</button>
  </div>
  <div class="hot">
    <span data-q="trending music 2025">Trending</span>
    <span data-q="top hits">Top Hits</span>
    <span data-q="lofi hip hop">Lofi</span>
    <span data-q="romantic songs">Romance</span>
    <span data-q="workout music">Workout</span>
    <span data-q="chill beats">Chill</span>
    <span data-q="K-pop">K-Pop</span>
    <span data-q="anime music">Anime</span>
  </div>
  <div id="results"></div>
</div>
<div class="overlay" id="overlay">
  <div class="overlay-bar">
    <button class="overlay-close" id="ovClose">&times;</button>
    <span class="overlay-title" id="ovTitle"></span>
  </div>
  <div class="overlay-body" id="ovBody"></div>
</div>
<div class="toast" id="toast"></div>
<div class="footer">Tubidy Search &mdash; For personal use only. All content belongs to respective owners.</div>
<script>
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}
function fmt(d){var m=Math.floor(d/60),s=d%60;return m+":"+(s<10?"0":"")+s}
function fmtViews(n){if(!n)return"";n=parseInt(n);if(n>=1e9)return(n/1e9).toFixed(1)+"B";if(n>=1e6)return(n/1e6).toFixed(1)+"M";if(n>=1e3)return(n/1e3).toFixed(1)+"K";return String(n)}
function showToast(t){var e=document.getElementById("toast");e.textContent=t;e.style.opacity=1;setTimeout(function(){e.style.opacity=0},3000)}
function doSearch(q){document.getElementById("sInput").value=q;search(q)}

// Hot chips
document.querySelectorAll(".hot span").forEach(function(el){
  el.addEventListener("click",function(){doSearch(el.getAttribute("data-q"))});
});

// Search
var searchTimer=null;
document.getElementById("sBtn").addEventListener("click",function(){search(document.getElementById("sInput").value)});
document.getElementById("sInput").addEventListener("keydown",function(e){if(e.key==="Enter")search(this.value)});
document.getElementById("sInput").addEventListener("input",function(){
  clearTimeout(searchTimer);
  var q=this.value.trim();
  if(!q){document.getElementById("results").innerHTML="";return}
});

async function search(q){
  if(!q||!q.trim())return;
  var r=document.getElementById("results");
  r.innerHTML='<div class="loading"><div class="spinner"></div>Searching YouTube...</div>';
  try{
    var resp=await fetch("/api/search?q="+encodeURIComponent(q.trim()));
    var data=await resp.json();
    if(!data.ok){
      r.innerHTML='<div class="error-box">Search error: '+esc(data.error||"Unknown")+'</div>';
      return;
    }
    if(!data.results||!data.results.length){
      r.innerHTML='<div class="empty"><p>No results found</p></div>';
      return;
    }
    var h='<div class="results">';
    data.results.forEach(function(v){
      h+='<div class="result" data-id="'+esc(v.id)+'">';
      h+='<div class="result-thumb">';
      h+='<img src="'+esc(v.thumb)+'" loading="lazy" onerror="this.parentElement.innerHTML=\\'<div style=\\\\\'width:100%;height:100%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;color:#555;font-size:20px\\\\\'>♫</div>\'">';
      if(v.duration)h+='<span class="dur">'+esc(v.durationStr||fmt(v.duration))+'</span>';
      h+='</div>';
      h+='<div class="result-info">';
      h+='<div class="result-title">'+esc(v.title)+'</div>';
      h+='<div class="result-meta"><span>'+esc(v.author)+'</span>';
      if(v.views)h+='<span>▶ '+fmtViews(v.views)+'</span>';
      if(v.ago)h+='<span>'+esc(v.ago)+'</span>';
      h+='</div></div>';
      h+='<span style="position:absolute;right:16px;top:50%;transform:translateY(-50%);color:#444;font-size:18px">›</span>';
      h+='</div>';
    });
    h+='</div>';
    r.innerHTML=h;
  }catch(e){
    r.innerHTML='<div class="error-box">Network error: '+esc(e.message)+'</div>';
  }
}

// Click result -> open detail
document.addEventListener("click",function(e){
  var r=e.target.closest(".result[data-id]");
  if(r){openDetail(r.getAttribute("data-id"));return}
  if(e.target.id==="ovClose"||e.target.closest("#ovClose")){document.getElementById("overlay").classList.remove("open");return}
  var dl=e.target.closest(".dl-item[data-url]");
  if(dl){
    var url=dl.getAttribute("data-url");
    var fname=dl.getAttribute("data-fname")||"download";
    if(url)dlDownload(url,fname);
    return;
  }
});

async function openDetail(id){
  var ov=document.getElementById("overlay");
  document.getElementById("ovTitle").textContent="Loading...";
  document.getElementById("ovBody").innerHTML='<div class="loading"><div class="spinner"></div>Fetching download formats...</div>';
  ov.classList.add("open");
  try{
    var resp=await fetch("/api/info?id="+encodeURIComponent(id));
    var data=await resp.json();
    if(!data.ok||!data.info){
      document.getElementById("ovBody").innerHTML='<div class="error-box">Error: '+esc(data.error||"Could not load video")+'</div>';
      document.getElementById("ovTitle").textContent="Error";
      return;
    }
    var info=data.info;
    document.getElementById("ovTitle").textContent=info.title||"Download";

    var h='<div class="dl-header">';
    h+='<div class="dl-thumb"><img src="'+esc(info.thumb)+'" onerror="this.style.opacity=.2"></div>';
    h+='<div class="dl-info"><h2>'+esc(info.title)+'</h2>';
    h+='<p>'+esc(info.author)+' &middot; '+fmt(info.duration||0)+'</p></div></div>';

    // Muxed video+audio
    if(info.muxed&&info.muxed.length){
      h+='<div class="section-label">📹 Download Video (with audio)</div>';
      info.muxed.forEach(function(f){
        var q=esc(f.quality);
        var sz=f.size?' &middot; '+esc(f.size):'';
        var res=f.width?esc(f.width+'x'+f.height):'';
        var fname=(info.title||"video").replace(/[^a-zA-Z0-9 ]/g,"").replace(/\\s+/g,"_").slice(0,60)+"_"+f.quality+".mp4";
        h+='<div class="dl-item" data-url="'+esc(f.url)+'" data-fname="'+esc(fname)+'">';
        h+='<div class="dl-icon video"><svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg></div>';
        h+='<div class="dl-detail"><div class="dl-format">'+q+'</div>';
        h+='<div class="dl-size">MP4'+(res?' &middot; '+res:'')+sz+'</div></div>';
        h+='<button class="dl-btn video">Download</button></div>';
      });
    }

    // Audio only
    if(info.audio&&info.audio.length){
      h+='<div class="section-label">🎵 Download Audio (MP3)</div>';
      info.audio.forEach(function(f){
        var q=esc(f.quality);
        var sz=f.size?' &middot; '+esc(f.size):'';
        var fname=(info.title||"audio").replace(/[^a-zA-Z0-9 ]/g,"").replace(/\\s+/g,"_").slice(0,60)+"_audio.mp3";
        h+='<div class="dl-item" data-url="'+esc(f.url)+'" data-fname="'+esc(fname)+'">';
        h+='<div class="dl-icon audio"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" stroke="white" stroke-width="1.5" fill="none"/><circle cx="6" cy="18" r="3" fill="white"/><circle cx="18" cy="16" r="3" fill="white"/></svg></div>';
        h+='<div class="dl-detail"><div class="dl-format">'+q+'</div>';
        h+='<div class="dl-size">Audio'+sz+'</div></div>';
        h+='<button class="dl-btn audio">Download</button></div>';
      });
    }

    // Video only (higher quality, no audio)
    if(info.videoOnly&&info.videoOnly.length){
      h+='<div class="section-label">🎬 HD Video (no audio - use for editing)</div>';
      info.videoOnly.slice(0,4).forEach(function(f){
        var q=esc(f.quality);
        var sz=f.size?' &middot; '+esc(f.size):'';
        var res=f.width?esc(f.width+'x'+f.height):'';
        var fname=(info.title||"video").replace(/[^a-zA-Z0-9 ]/g,"").replace(/\\s+/g,"_").slice(0,60)+"_hd.mp4";
        h+='<div class="dl-item" data-url="'+esc(f.url)+'" data-fname="'+esc(fname)+'">';
        h+='<div class="dl-icon video"><svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg></div>';
        h+='<div class="dl-detail"><div class="dl-format">'+q+'</div>';
        h+='<div class="dl-size">MP4 Video Only'+(res?' &middot; '+res:'')+sz+'</div></div>';
        h+='<button class="dl-btn video">Download</button></div>';
      });
    }

    if(!info.muxed.length&&!info.audio.length&&!info.videoOnly.length){
      h+='<div class="empty"><p>No downloadable formats found</p></div>';
    }

    h+='<div style="margin-top:16px;text-align:center"><a href="https://www.youtube.com/watch?v='+esc(id)+'" target="_blank" rel="noopener" style="color:#555;font-size:12px;text-decoration:underline">Open on YouTube</a></div>';
    document.getElementById("ovBody").innerHTML=h;
  }catch(e){
    document.getElementById("ovBody").innerHTML='<div class="error-box">Error: '+esc(e.message)+'</div>';
    document.getElementById("ovTitle").textContent="Error";
  }
}

function dlDownload(url,fname){
  if(!url){showToast("No download URL available");return}
  showToast("Starting download...");
  var a=document.createElement("a");
  a.href=url;
  a.download=fname||"download";
  a.target="_blank";
  a.rel="noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
</script>
</body></html>`;

app.get('/', function(req, res) { res.type('html').send(HTML); });

app.listen(PORT, function() { console.log('Tubidy Search on port ' + PORT); });
