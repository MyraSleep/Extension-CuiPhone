/* =====================================================================
 * CUI Phone — phone UI (extracted from clean HTML, scoped to mount root)
 * ===================================================================== */

export function mountPhoneUI(root) {
    const state = {
      currentView:'lock',
      currentInsPanel:'feed',
      currentKktPanel:'list',
      currentStory:0,
      storyStartX:0,
      currentRoom:'choi',
      composeMode:'feed',
      callTimer:null,
      callSeconds:0,
      user:{handle:'my.archive',name:'你的名字',bio:'这是用户主页，可自定义。角色动态在 Feed 里看。',link:'your-link.example',avatar:'',posts:9,followers:312,following:187,highlights:['工作','片场','夜景','随手拍'],grid:['archive','late','busan','notes','daily','mirror','blue','night','off']},
      avatars:{'@me':'','@jungsoo_23':'','@jongsoo_23':'','@byeongchan_21':'','@yjjeon_4':''},
      stories:[],
      posts:[],
      rooms:[
        {id:'choi',name:'崔宗秀',avatar:'',preview:'看完消息回我。',time:'05:37',unread:1,kind:'单聊',read:false},
        {id:'team',name:'工作群',avatar:'',preview:'7:10 集合，不要迟到。',time:'昨天',unread:3,kind:'7 人群聊',read:false}
      ],
      roomIdentity:{},
      threads:{
        choi:[
          {side:'other',name:'崔宗秀',time:'22:14',text:'你醒了再回。'},
          {side:'me',name:'me',time:'22:15',text:'刚看到。'},
          {side:'other',name:'崔宗秀',time:'22:16',text:'INS 那边也记得更新。'},
          {side:'other',name:'崔宗秀',time:'22:16',text:'Story 不要发完就跑。'},
          {side:'me',name:'me',time:'22:17',text:'知道了。'}
        ],
        team:[
          {side:'other',name:'工作群',time:'20:14',text:'7:10 集合。'},
          {side:'other',name:'工作群',time:'20:14',text:'服装不要忘。'},
          {side:'me',name:'me',time:'20:16',text:'收到。'}
        ]
      },
      defaultImport:''
    };

    const defaultImportText = '';

    const $ = s => root.querySelector(s);
    const $$ = s => Array.from(root.querySelectorAll(s));
    const escapeHtml = str => String(str ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const isImageUrl = v => /^(https?:)?\/\//i.test(String(v || '').trim()) || /^data:image\//i.test(String(v || '').trim());
    const cssUrl = v => String(v || '').replace(/"/g,'\\"').replace(/\n/g,'');
    const likesText = n => `${Number(n || 0).toLocaleString('en-US')} likes`;
    const roomById = id => state.rooms.find(r => r.id === id) || state.rooms[0];

    function applyAvatar(el, value, fallback){
      if(!el) return;
      const raw = String(value || '').trim();
      const hasImage = isImageUrl(raw);
      el.style.backgroundImage = hasImage ? `url("${cssUrl(raw)}")` : 'none';
      el.classList.toggle('has-image', hasImage);
      el.textContent = hasImage ? '' : String(raw || fallback || '').slice(0,3).toUpperCase();
    }

    function switchView(name){
      state.currentView = name;
      $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
    }
    function switchInsPanel(name){
      state.currentInsPanel = name;
      $$('[data-ins-panel]').forEach(p => p.classList.toggle('active', p.dataset.insPanel === name));
      $$('.ins-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.insTab === name));
      const sub = $('#insSubline');
      if(sub) sub.textContent = name === 'feed' ? 'Following feed' : name === 'story' ? 'Story preview' : 'Profile';
    }
    function switchKktPanel(name){
      state.currentKktPanel = name;
      $$('[data-kkt-panel]').forEach(p => p.classList.toggle('active', p.dataset.kktPanel === name));
      const sub = $('#kktSubline');
      if(sub) sub.textContent = name === 'list' ? 'Chats' : '单聊';
    }

    function parseLikes(line){
      const m = String(line || '').match(/([0-9][0-9,]*)/);
      return m ? parseInt(m[1].replace(/,/g,''), 10) : 0;
    }

    function parseStoryBlocks(text){
      const matches = [...String(text || '').matchAll(/<ins_story>\s*([\s\S]*?)\s*<\/ins_story>/g)];
      return matches.map(m => m[1].trim()).filter(Boolean).map(block => {
        const lines = block.split('\n').map(s => s.trim()).filter(Boolean);
        const head = lines.shift() || '@user · 用户 | 00:00';
        const hm = head.match(/^(@[^\s]+)\s*[·•]\s*(.*?)\s*\|\s*(\d{1,2}:\d{2})$/);
        const handle = hm ? hm[1] : '@user';
        const name = hm ? hm[2] : '用户';
        const time = hm ? hm[3] : '00:00';
        let mediaUrl = '';
        const chips = [];
        lines.forEach(line => {
          if(/^图片[:：]/i.test(line)){ mediaUrl = line.replace(/^图片[:：]\s*/i,'').trim(); return; }
          if(/^\[贴纸/.test(line)){ chips.push({type:'sticker',text:line}); return; }
          if(/^\[音乐/.test(line)){ chips.push({type:'music',text:line.replace(/^\[音乐\s*·?\s*/,'').replace(/\]$/,'')}); return; }
          chips.push({type:'text',text:line.replace(/^story\s*字幕[:：]?\s*/i,'')});
        });
        return {handle,name,time,avatar:state.avatars[handle] || '',mediaUrl,bg:'radial-gradient(circle at 52% 18%, rgba(255,255,255,.18), transparent 22%), linear-gradient(160deg,#0f172a,#334155 52%,#475569)',chips};
      });
    }

    function parseFeedBlocks(text){
      const match = String(text || '').match(/<ins_feed>\s*([\s\S]*?)\s*<\/ins_feed>/);
      const inner = match ? match[1].trim() : String(text || '').trim();
      const groups = inner.split(/\n\s*\n(?=@)/).map(s => s.trim()).filter(Boolean);
      const bgs = [
        'radial-gradient(circle at 50% 18%, rgba(255,255,255,.18), transparent 22%), linear-gradient(160deg,#111827,#243447 52%,#0f172a)',
        'radial-gradient(circle at 30% 18%, rgba(255,255,255,.16), transparent 20%), linear-gradient(160deg,#0f766e,#115e59 55%,#022c22)',
        'radial-gradient(circle at 50% 12%, rgba(255,255,255,.15), transparent 18%), linear-gradient(160deg,#7c2d12,#c2410c 58%,#431407)',
        'radial-gradient(circle at 52% 16%, rgba(255,255,255,.16), transparent 18%), linear-gradient(160deg,#172554,#1d4ed8 55%,#0f172a)'
      ];
      return groups.map((group, idx) => {
        const lines = group.split('\n').map(s => s.trim()).filter(Boolean);
        const head = lines.shift() || '@user · 用户 | 00:00';
        const media = lines.shift() || '[图 · 默认图片描述]';
        let mediaUrl = '';
        if(/^图片[:：]/i.test(lines[0] || '')) mediaUrl = lines.shift().replace(/^图片[:：]\s*/i,'').trim();
        let likes = 0;
        if(/^❤️/.test(lines[0] || '')) likes = parseLikes(lines.shift());
        const caption = lines.shift() || '';
        const comments = lines;
        const hm = head.match(/^(@[^\s]+)\s*[·•]\s*(.*?)\s*\|\s*(.*)$/);
        const handle = hm ? hm[1] : '@user';
        const name = hm ? hm[2] : '用户';
        const place = hm ? hm[3] : '00:00';
        return {handle,name,place,likes,caption,comments,overlay:media,mediaUrl,avatar:state.avatars[handle] || '',bg:bgs[idx % bgs.length]};
      });
    }

    function parseUserProfile(text){
      const match = String(text || '').match(/<user_profile>\s*([\s\S]*?)\s*<\/user_profile>/);
      if(!match) return;
      match[1].split('\n').map(s => s.trim()).filter(Boolean).forEach(line => {
        const [key, ...rest] = line.split('=');
        const val = rest.join('=').trim();
        if(!key) return;
        const k = key.trim();
        if(k === 'handle') state.user.handle = val.replace(/^@/, '') || state.user.handle;
        if(k === 'name') state.user.name = val || state.user.name;
        if(k === 'bio') state.user.bio = val || state.user.bio;
        if(k === 'link') state.user.link = val || state.user.link;
        if(k === 'avatar') state.user.avatar = val || state.user.avatar;
        if(k === 'highlights') state.user.highlights = val.split(',').map(s => s.trim()).filter(Boolean).slice(0,8);
        if(k === 'grid') state.user.grid = val.split(',').map(s => s.trim()).filter(Boolean).slice(0,9);
        if(k === 'followers') state.user.followers = Number(val) || state.user.followers;
        if(k === 'following') state.user.following = Number(val) || state.user.following;
      });
      state.avatars['@me'] = state.user.avatar;
    }

    function parseKktRooms(text){
      const matches = [...String(text || '').matchAll(/<kkt_room([^>]*)>\s*([\s\S]*?)\s*<\/kkt_room>/g)];
      matches.forEach(m => {
        const attrs = m[1] || '';
        const body = m[2] || '';
        const id = (attrs.match(/id="([^"]+)"/) || [,'room_' + Math.random().toString(36).slice(2,7)])[1];
        const name = (attrs.match(/name="([^"]+)"/) || [,'聊天室'])[1];
        const avatar = (attrs.match(/avatar="([^"]+)"/) || [,''])[1];
        let room = state.rooms.find(r => r.id === id);
        if(!room){ room = {id,name,avatar,preview:'',time:'',unread:0,kind:'单聊'}; state.rooms.push(room); }
        room.name = name || room.name;
        if(avatar) room.avatar = avatar;
        const messages = body.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
          const [side='other', time='00:00', ...rest] = line.split('|');
          const text = rest.join('|').trim();
          return {side: side === 'me' ? 'me' : 'other', name: side === 'me' ? 'me' : room.name, time, text};
        }).filter(msg => msg.text);
        if(messages.length) { state.threads[id] = messages; room.read = false; room.unread = Math.max(room.unread || 0, messages.filter(msg => msg.side !== 'me').length); }
      });
    }

    /**
     * Parse <kakao_chat>...</kakao_chat> blocks per worldbook spec:
     *   - Optional first line: group name like "[群聊] xxx" / "[KKT群] xxx"
     *   - Repeating two-line message blocks:
     *       "⚫ 角色名 | HH:MM"  + next line  "ᄀ 内容"     (other side)
     *       "🟡 用户名 | HH:MM"  + next line  "ᄀ 内容"     (me)
     *   - Sticker syntax inside content:  <bqb>描述 文件名.gif</bqb>
     * Each <kakao_chat> block becomes ONE room. Multiple blocks => multiple rooms.
     */
    function parseKakaoChatBlocks(text){
      const out = [];
      const matches = [...String(text || '').matchAll(/<kakao_chat>\s*([\s\S]*?)\s*<\/kakao_chat>/g)];
      matches.forEach((m, blockIdx) => {
        const lines = m[1].split('\n').map(s => s.trim()).filter(Boolean);
        if (!lines.length) return;

        // Detect optional group-name header line
        let groupName = null;
        if (lines[0] && !/^[⚫🟡ᄀ]/u.test(lines[0])) {
          groupName = lines[0].replace(/^\s*\[(?:群聊|KKT群|群)\]\s*/, '').trim() || lines[0];
          lines.shift();
        }

        const messages = [];
        let primaryName = null; // first 1v1 partner becomes the room name fallback
        for (let i = 0; i < lines.length; i++) {
          const head = lines[i];
          const headMatch = head.match(/^([⚫🟡])\s*([^|]+?)\s*\|\s*(\d{1,2}:\d{2})\s*$/u);
          if (!headMatch) continue;
          const isMe = headMatch[1] === '🟡';
          const speaker = headMatch[2].trim();
          const time = headMatch[3];
          // Find next "ᄀ" body line
          let body = '';
          for (let j = i + 1; j < lines.length; j++) {
            const b = lines[j];
            if (/^[⚫🟡]/u.test(b)) break;
            const bm = b.match(/^ᄀ\s*(.*)$/);
            if (bm) { body = bm[1].trim(); i = j; break; }
          }
          if (!body) continue;
          if (!isMe && !primaryName) primaryName = speaker;
          messages.push({
            side: isMe ? 'me' : 'other',
            name: isMe ? 'me' : speaker,
            time,
            text: body,
          });
        }

        if (!messages.length && !groupName) return;

        const id = 'kkt_' + blockIdx;
        const roomName = groupName || primaryName || '聊天室';
        const room = {
          id,
          name: roomName,
          avatar: '',
          preview: messages.length ? messages[messages.length - 1].text.slice(0, 60) : '',
          time: messages.length ? messages[messages.length - 1].time : '',
          unread: messages.filter(x => x.side !== 'me').length,
          kind: groupName ? '群聊' : '单聊',
          read: false,
        };
        out.push({ room, messages });
      });
      return out;
    }

    function applyImport(text){
      const raw = String(text || '').trim();
      if(!raw) return;
      parseUserProfile(raw);
      const stories = parseStoryBlocks(raw);
      const posts = parseFeedBlocks(raw);
      if(stories.length) state.stories = stories;
      if(posts.length){ state.posts = posts; state.user.posts = Math.max(state.user.posts, posts.length); }

      // Prefer new <kakao_chat> format; fall back to legacy <kkt_room>
      const kakao = parseKakaoChatBlocks(raw);
      if (kakao.length) {
        // Replace rooms / threads completely with the parsed set (predictable behaviour)
        state.rooms = kakao.map(k => k.room);
        state.threads = {};
        kakao.forEach(k => { state.threads[k.room.id] = k.messages; });
        if (!state.rooms.find(r => r.id === state.currentRoom)) {
          state.currentRoom = state.rooms[0]?.id || state.currentRoom;
        }
      } else {
        parseKktRooms(raw);
      }
      refreshAll();
    }

    function getRoomAvatar(room){
      const saved = state.roomIdentity[room.id];
      if(saved?.avatar) return saved.avatar;
      if(room.avatar) return room.avatar;
      if(room.id === 'choi') return state.avatars['@jungsoo_23'] || '';
      return '';
    }

    function updateRoomPreview(roomId){
      const room = roomById(roomId);
      const thread = state.threads[roomId] || [];
      const last = thread[thread.length - 1];
      if(last){ room.preview = last.text; room.time = last.time || room.time; }
    }

    function goNextStory(){
      if(!state.stories.length) return;
      state.currentStory = (state.currentStory + 1) % state.stories.length;
      renderStories();
      renderStoryViewer();
    }

    function renderStories(){
      const wrap = $('#storiesRow');
      const progress = $('#storyProgress');
      if(!wrap || !progress) return;
      wrap.innerHTML = state.stories.map((story,i)=>`<div class="story-pill" data-story="${i}"><div class="story-ring"><div class="avatar-core" data-avatar="${escapeHtml(story.avatar)}" data-fallback="${escapeHtml((story.name || story.handle).slice(0,2))}"></div></div><span>${escapeHtml((story.name || story.handle).replace('@','').slice(0,8))}</span></div>`).join('');
      progress.innerHTML = state.stories.map((_,i)=>`<div class="story-progress"><div class="story-progress-fill" style="width:${i < state.currentStory ? 100 : i === state.currentStory ? 86 : 0}%"></div></div>`).join('');
      $$('#storiesRow [data-story]').forEach(el => el.addEventListener('click', () => { state.currentStory = Number(el.dataset.story); renderStoryViewer(); switchInsPanel('story'); }));
      $$('#storiesRow [data-avatar]').forEach(el => applyAvatar(el, el.dataset.avatar, el.dataset.fallback));
    }

    function renderStoryViewer(){
      renderStories();
      const story = state.stories[state.currentStory] || state.stories[0];
      if(!story) return;
      applyAvatar($('#storyAvatar'), story.avatar, (story.name || story.handle).slice(0,2));
      $('#storyHandle').textContent = `${story.handle} · ${story.name}`;
      $('#storyMeta').textContent = `${story.time} · 第 ${state.currentStory + 1}/${state.stories.length} 条`;
      const canvas = $('#storyCanvas');
      canvas.style.setProperty('--story-bg', story.bg);
      if(story.mediaUrl){
        canvas.classList.add('has-image');
        canvas.style.setProperty('--story-image', `url("${cssUrl(story.mediaUrl)}")`);
      }else{
        canvas.classList.remove('has-image');
        canvas.style.removeProperty('--story-image');
      }
      $('#storyChips').innerHTML = story.chips.map(ch => `<div class="story-chip ${escapeHtml(ch.type)}">${escapeHtml(ch.text)}</div>`).join('');
    }

    function renderFeed(){
      const list = $('#feedList');
      list.innerHTML = state.posts.map((post, idx) => `
        <article class="post" data-post="${idx}">
          <div class="post-head">
            <div class="post-user">
              <div class="post-avatar-wrap"><div class="avatar-core" data-avatar="${escapeHtml(post.avatar)}" data-fallback="${escapeHtml((post.name || post.handle).slice(0,2))}"></div></div>
              <div class="post-meta"><div class="post-handle">${escapeHtml(post.handle)} · ${escapeHtml(post.name)}</div><div class="post-place">${escapeHtml(post.place)}</div></div>
            </div>
          </div>
          <div class="post-media ${post.mediaUrl ? 'has-image' : ''}" style="--post-bg:${post.bg};${post.mediaUrl ? `--post-image:url('${cssUrl(post.mediaUrl)}')` : ''}"><div class="post-overlay">${escapeHtml(post.overlay)}</div></div>
          <div class="post-actions"><div class="post-actions-left"><span class="icon-btn like-btn">♡</span><span class="icon-btn">💬</span><span class="icon-btn">✦</span></div><span class="icon-btn">⋯</span></div>
          <div class="post-likes">${likesText(post.likes)}</div>
          <div class="post-caption">${escapeHtml(post.caption)}</div>
          <div class="post-comments">${post.comments.map(c => `<div>${escapeHtml(c)}</div>`).join('')}</div>
          <div class="comment-row"><input class="comment-input" placeholder="评论…" /><button class="mini-btn">发布</button></div>
        </article>`).join('');
      $$('#feedList [data-avatar]').forEach(el => applyAvatar(el, el.dataset.avatar, el.dataset.fallback));
      $$('#feedList .post').forEach((postEl, idx) => {
        const likeBtn = postEl.querySelector('.like-btn');
        const likesEl = postEl.querySelector('.post-likes');
        let liked = false; let count = state.posts[idx].likes || 0;
        likeBtn.addEventListener('click', () => {
          liked = !liked; count += liked ? 1 : -1; if(count < 0) count = 0;
          likeBtn.textContent = liked ? '♥' : '♡';
          likeBtn.classList.toggle('liked', liked);
          likesEl.textContent = likesText(count);
        });
        const input = postEl.querySelector('.comment-input');
        const btn = postEl.querySelector('.mini-btn');
        const wrap = postEl.querySelector('.post-comments');
        const submit = () => {
          const value = input.value.trim();
          if(!value) return;
          const div = document.createElement('div');
          div.textContent = '@me：' + value;
          wrap.appendChild(div);
          input.value = '';
        };
        btn.addEventListener('click', submit);
        input.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); submit(); } });
      });
    }

    function renderProfile(){
      $('#userHandleText').textContent = '@' + state.user.handle.replace(/^@/, '');
      $('#userNameText').textContent = state.user.name;
      $('#userBioText').textContent = state.user.bio;
      $('#userLinkText').textContent = state.user.link;
      $('#userPostsCount').textContent = state.user.posts;
      $('#userFollowersCount').textContent = state.user.followers;
      $('#userFollowingCount').textContent = state.user.following;
      applyAvatar($('#userAvatarMain'), state.user.avatar, 'ME');
      applyAvatar($('#userAvatarPreview'), state.user.avatar, 'ME');
      applyAvatar($('#characterAvatarPreview'), state.avatars['@jungsoo_23'], 'CZ');
      $('#userAvatarInput').value = state.user.avatar || '';
      $('#characterAvatarInput').value = state.avatars['@jungsoo_23'] || '';
      $('#avatarMapInput').value = Object.entries(state.avatars).map(([k,v]) => `${k}=${v}`).join('\n');
      $('#editHandle').value = state.user.handle;
      $('#editName').value = state.user.name;
      $('#editBio').value = state.user.bio;
      $('#editLink').value = state.user.link;
      $('#editHighlights').value = state.user.highlights.join(', ');
      $('#editGridCaptions').value = state.user.grid.join(', ');
      $('#highlightRow').innerHTML = state.user.highlights.map(item => `<div class="highlight-item"><div class="highlight-ring"><div class="highlight-core">${escapeHtml(item.slice(0,4))}</div></div><span>${escapeHtml(item)}</span></div>`).join('');
      $('#profileGrid').innerHTML = Array.from({length:9}).map((_,i) => {
        const post = state.posts[i % Math.max(state.posts.length,1)] || {bg:'linear-gradient(160deg,#111827,#334155)',mediaUrl:''};
        return `<div class="grid-post" style="--thumb-bg:${post.bg};--post-image:${post.mediaUrl ? `url('${cssUrl(post.mediaUrl)}')` : 'none'}"><span>${escapeHtml(state.user.grid[i] || '')}</span></div>`;
      }).join('');
    }

    function renderChatList(){
      state.rooms.forEach(room => updateRoomPreview(room.id));
      $('#chatList').innerHTML = state.rooms.map(room => {
        const avatar = getRoomAvatar(room);
        const title = state.roomIdentity[room.id]?.name || room.name;
        return `<button class="chat-item" data-room="${escapeHtml(room.id)}"><div class="chat-avatar avatar-core" data-avatar="${escapeHtml(avatar)}" data-fallback="${escapeHtml(title.slice(0,2))}"></div><div class="chat-main"><div class="chat-topline"><div class="chat-name">${escapeHtml(title)}</div></div><div class="chat-preview">${escapeHtml(room.preview || '')}</div></div><div class="chat-meta"><div class="chat-time">${escapeHtml(room.time || '')}</div>${room.unread && !room.read ? `<div class="chat-unread">${room.unread}</div>` : ''}</div></button>`;
      }).join('');
      $$('#chatList [data-room]').forEach(el => el.addEventListener('click', () => openRoom(el.dataset.room)));
      $$('#chatList [data-avatar]').forEach(el => applyAvatar(el, el.dataset.avatar, el.dataset.fallback));
    }

    /**
     * Render a single bubble's content. Detects <bqb>desc filename.ext</bqb>
     * stickers and renders them as a small sticker tile (text-only fallback,
     * since we don't ship the image files).
     */
    function renderBubbleContent(text){
      const raw = String(text || '');
      const m = raw.match(/^\s*<bqb>\s*([\s\S]*?)\s*<\/bqb>\s*$/);
      if (m) {
        const inner = m[1].trim();
        // last whitespace-separated token that looks like a filename
        const fileMatch = inner.match(/(\S+\.(?:png|jpe?g|gif|webp))\s*$/i);
        const file = fileMatch ? fileMatch[1] : '';
        const desc = file ? inner.slice(0, inner.length - file.length).trim() : inner;
        return `<div class="sticker-bubble" title="${escapeHtml(file)}">`
             + `<div class="sticker-emoji">🎨</div>`
             + `<div class="sticker-desc">${escapeHtml(desc || file || '贴纸')}</div>`
             + `</div>`;
      }
      return escapeHtml(raw);
    }

    function renderThread(){
      const room = roomById(state.currentRoom);
      const title = state.roomIdentity[room.id]?.name || room.name;
      $('#roomName').textContent = title;
      $('#roomSub').textContent = room.kind || '聊天';
      applyAvatar($('#roomAvatar'), getRoomAvatar(room), title.slice(0,2));
      const messages = state.threads[room.id] || [];
      const html = messages.length ? messages.map(msg => msg.side === 'me'
        ? `<div class="msg me"><div class="msg-stack"><div class="msg-line"><div class="msg-time">${escapeHtml(msg.time)}</div><div class="bubble">${renderBubbleContent(msg.text)}</div></div></div></div>`
        : `<div class="msg other"><div class="msg-avatar avatar-core" data-avatar="${escapeHtml(getRoomAvatar(room))}" data-fallback="${escapeHtml(title.slice(0,2))}"></div><div class="msg-stack"><div class="msg-name">${escapeHtml(msg.name || title)}</div><div class="msg-line"><div class="bubble">${renderBubbleContent(msg.text)}</div><div class="msg-time">${escapeHtml(msg.time)}</div></div></div></div>`
      ).join('') : '<div class="day-badge">暂无消息</div>';
      $('#thread').innerHTML = `<div class="day-badge">今天</div>${html}`;
      $$('#thread [data-avatar]').forEach(el => applyAvatar(el, el.dataset.avatar, el.dataset.fallback));
      $('#thread').scrollTop = $('#thread').scrollHeight;
    }

    function openRoom(id){ state.currentRoom = id; const room = roomById(id); room.read = true; room.unread = 0; renderChatList(); renderThread(); switchKktPanel('chat'); }

    function openCall(){
      const room = roomById(state.currentRoom);
      const title = state.roomIdentity[room.id]?.name || room.name;
      applyAvatar($('#callAvatar'), getRoomAvatar(room), title.slice(0,2));
      $('#callName').textContent = title;
      $('#callState').textContent = '连接中';
      $('#callScreen').classList.add('active');
      clearInterval(state.callTimer);
      state.callSeconds = 0;
      state.callTimer = setInterval(() => {
        state.callSeconds += 1;
        if(state.callSeconds > 2) $('#callState').textContent = `${String(Math.floor(state.callSeconds / 60)).padStart(2,'0')}:${String(state.callSeconds % 60).padStart(2,'0')}`;
      }, 1000);
    }

    function closeCall(backToChat = true){
      $('#callScreen').classList.remove('active');
      clearInterval(state.callTimer);
      state.callTimer = null;
      if(backToChat) switchKktPanel('chat');
    }

    function openRoomEditor(){
      const room = roomById(state.currentRoom);
      $('#roomNameInput').value = state.roomIdentity[room.id]?.name || room.name;
      $('#roomAvatarInput').value = state.roomIdentity[room.id]?.avatar || room.avatar || '';
      $('#roomEditorSheet').classList.remove('collapsed');
    }
    function closeRoomEditor(){ $('#roomEditorSheet').classList.add('collapsed'); }

    function submitKkt(){
      const input = $('#kktInput');
      const text = input.value.trim();
      if(!text) return;
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      if(!state.threads[state.currentRoom]) state.threads[state.currentRoom] = [];
      state.threads[state.currentRoom].push({side:'me',name:'me',time,text});
      updateRoomPreview(state.currentRoom);
      renderChatList();
      renderThread();
      // ★ Bridge: mirror this message into SillyTavern's main composer
      try { window.CuiPhone && window.CuiPhone.sendToST && window.CuiPhone.sendToST(text); } catch(e) { console.warn('[CUI Phone] sendToST failed', e); }
      input.value = '';
    }

    function setComposeMode(mode){
      state.composeMode = mode;
      $$('[data-compose]').forEach(btn => btn.classList.toggle('active', btn.dataset.compose === mode));
      $('#composerLikes').classList.toggle('hidden', mode === 'story');
      $('#composerComments').classList.toggle('hidden', mode === 'story');
    }

    function openComposer(mode='feed'){
      setComposeMode(mode);
      $('#composerMeta').value = mode === 'feed' ? '18:42 我的动态' : '23:41';
      ['composerMedia','composerMediaUrl','composerLikes','composerText','composerComments'].forEach(id => $('#'+id).value = '');
      $('#composerPanel').classList.add('active');
    }
    function closeComposer(){ $('#composerPanel').classList.remove('active'); }

    function publishComposer(){
      const handle = '@' + state.user.handle.replace(/^@/, '');
      const meta = $('#composerMeta').value.trim() || (state.composeMode === 'feed' ? '18:42 我的动态' : '23:41');
      const media = $('#composerMedia').value.trim() || '[图 · 默认图片描述]';
      const mediaUrl = $('#composerMediaUrl').value.trim();
      const text = $('#composerText').value.trim();
      if(state.composeMode === 'story'){
        const extra = text.split('\n').map(s => s.trim()).filter(Boolean);
        const chips = [media, ...extra].map(line => {
          if(/^\[贴纸/.test(line)) return {type:'sticker',text:line};
          if(/^\[音乐/.test(line)) return {type:'music',text:line.replace(/^\[音乐\s*·?\s*/,'').replace(/\]$/,'')};
          return {type:'text',text:line.replace(/^story\s*字幕[:：]?\s*/i,'')};
        });
        state.stories.unshift({handle,name:state.user.name,time:meta,avatar:state.user.avatar,mediaUrl,bg:'radial-gradient(circle at 50% 18%, rgba(255,255,255,.18), transparent 22%), linear-gradient(160deg,#4338ca,#7c3aed 52%,#1e1b4b)',chips});
        state.currentStory = 0;
        renderStories(); renderStoryViewer(); closeComposer(); switchInsPanel('story');
      }else{
        const comments = $('#composerComments').value.split('\n').map(s => s.trim()).filter(Boolean);
        const likes = parseLikes($('#composerLikes').value) || 0;
        state.posts.unshift({handle,name:state.user.name,place:meta,likes,caption:text || '我的新动态。',comments,overlay:media,mediaUrl,avatar:state.user.avatar,bg:'radial-gradient(circle at 50% 16%, rgba(255,255,255,.16), transparent 18%), linear-gradient(160deg,#7c3aed,#ec4899 55%,#312e81)'});
        state.user.posts += 1;
        renderFeed(); renderProfile(); closeComposer(); switchInsPanel('feed');
      }
    }

    function openProfileEditor(){ $('#profileEditor').classList.remove('collapsed'); $('#avatarEditor').classList.remove('collapsed'); $('#openProfileEditBtn').textContent = '正在编辑'; }
    function closeProfileEditor(){ $('#profileEditor').classList.add('collapsed'); $('#avatarEditor').classList.add('collapsed'); $('#openProfileEditBtn').textContent = '编辑主页'; }

    function applyAvatarSettings(){
      state.user.avatar = $('#userAvatarInput').value.trim();
      state.avatars['@me'] = state.user.avatar;
      state.avatars['@jungsoo_23'] = $('#characterAvatarInput').value.trim();
      state.avatars['@jongsoo_23'] = state.avatars['@jungsoo_23'];
      $('#avatarMapInput').value.split('\n').map(s => s.trim()).filter(Boolean).forEach(line => {
        if(!line.includes('=')) return;
        const [key, value] = line.split('=');
        if(key && value) state.avatars[key.trim()] = value.trim();
      });
      state.stories = state.stories.map(story => ({...story, avatar: story.handle === '@' + state.user.handle ? state.user.avatar : (state.avatars[story.handle] || story.avatar)}));
      state.posts = state.posts.map(post => ({...post, avatar: post.handle === '@' + state.user.handle || post.handle === '@me' ? state.user.avatar : (state.avatars[post.handle] || post.avatar)}));
      renderStories(); renderStoryViewer(); renderFeed(); renderProfile(); renderChatList(); renderThread();
      $('#avatarHint').textContent = '修改后会同步到 Story、Feed、主页与 KKT。';
    }

    function saveProfile(){
      const prevHandle = state.user.handle;
      state.user.handle = $('#editHandle').value.trim().replace(/^@/,'') || state.user.handle;
      state.user.name = $('#editName').value.trim() || state.user.name;
      state.user.bio = $('#editBio').value.trim() || state.user.bio;
      state.user.link = $('#editLink').value.trim() || state.user.link;
      const highlights = $('#editHighlights').value.trim();
      const grid = $('#editGridCaptions').value.trim();
      if(highlights) state.user.highlights = highlights.split(',').map(s => s.trim()).filter(Boolean).slice(0,8);
      if(grid){
        const arr = grid.split(',').map(s => s.trim()).filter(Boolean);
        state.user.grid = Array.from({length:9}).map((_,i) => arr[i] || arr[arr.length - 1] || '');
      }
      state.stories = state.stories.map(story => {
        const own = story.handle === '@' + prevHandle || story.handle === '@' + state.user.handle || story.handle === '@me';
        return own ? {...story, handle:'@' + state.user.handle, name:state.user.name, avatar:state.user.avatar || story.avatar} : story;
      });
      state.posts = state.posts.map(post => {
        const own = post.handle === '@' + prevHandle || post.handle === '@' + state.user.handle || post.handle === '@me';
        return own ? {...post, handle:'@' + state.user.handle, name:state.user.name, avatar:state.user.avatar || post.avatar} : post;
      });
      renderStories(); renderStoryViewer(); renderFeed(); renderProfile(); closeProfileEditor();
    }

    function refreshAll(){
      renderStories();
      renderStoryViewer();
      renderFeed();
      renderProfile();
      renderChatList();
      renderThread();
      $('#stImportText').value = state.defaultImport;
    }

    function updateClock(){
      const now = new Date();
      const hh = String(now.getHours()).padStart(2,'0');
      const mm = String(now.getMinutes()).padStart(2,'0');
      const days = ['周日','周一','周二','周三','周四','周五','周六'];
      $('#statusTime').textContent = `${hh}:${mm}`;
      $('#lockTime').textContent = `${hh}:${mm}`;
      $('#lockDate').textContent = `${days[now.getDay()]} ${(now.getMonth()+1)}/${now.getDate()}`;
    }

    function bindUI(){
      $('[data-view="lock"]').addEventListener('click', () => switchView('home'));
      $$('[data-open-app]').forEach(btn => btn.addEventListener('click', () => {
        const app = btn.dataset.openApp;
        if(app === 'ins'){ switchView('ins'); switchInsPanel('feed'); }
        if(app === 'kkt'){ switchView('kkt'); switchKktPanel('list'); renderChatList(); }
        if(app === 'st'){ switchView('st'); }
      }));
      $$('[data-home]').forEach(btn => btn.addEventListener('click', () => {
        if(state.currentView === 'ins'){
          if(state.currentInsPanel === 'story'){ switchInsPanel('feed'); return; }
          if(state.currentInsPanel === 'profile'){ closeProfileEditor(); switchInsPanel('feed'); return; }
        }
        if(state.currentView === 'kkt'){
          if($('#callScreen').classList.contains('active')){ closeCall(true); return; }
          if(state.currentKktPanel === 'chat'){ $('#emojiSheet').classList.add('collapsed'); closeRoomEditor(); switchKktPanel('list'); return; }
          closeRoomEditor();
        }
        switchView('home');
      }));
      $$('.ins-tab').forEach(btn => btn.addEventListener('click', () => switchInsPanel(btn.dataset.insTab)));
      $('#storyLikeBtn').addEventListener('click', e => { e.currentTarget.textContent = e.currentTarget.textContent === '♡' ? '♥' : '♡'; });
      const sendStoryReply = () => { const input = $('#storyReplyInput'); if(!input.value.trim()) return; input.value=''; };
      $('#storySendBtn').addEventListener('click', sendStoryReply);
      $('#storyReplyInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); sendStoryReply(); } });
      const storyCanvas = $('#storyCanvas');
      storyCanvas.addEventListener('click', e => { if(e.clientX > window.innerWidth / 2) goNextStory(); });
      storyCanvas.addEventListener('touchstart', e => { state.storyStartX = e.touches[0].clientX; }, {passive:true});
      storyCanvas.addEventListener('touchend', e => { const dx = state.storyStartX - e.changedTouches[0].clientX; if(dx > 36) goNextStory(); });
      $('#openComposerBtn').addEventListener('click', () => openComposer(state.currentInsPanel === 'story' ? 'story' : 'feed'));
      $$('.composer-tab').forEach(btn => btn.addEventListener('click', () => setComposeMode(btn.dataset.compose)));
      $('#closeComposerBtn').addEventListener('click', closeComposer);
      $('#publishComposerBtn').addEventListener('click', publishComposer);
      $('#openProfileEditBtn').addEventListener('click', openProfileEditor);
      $('#cancelProfileEditBtn').addEventListener('click', () => { closeProfileEditor(); renderProfile(); });
      $('#applyAvatarBtn').addEventListener('click', applyAvatarSettings);
      $('#saveProfileBtn').addEventListener('click', saveProfile);
      $('#sendKktBtn').addEventListener('click', submitKkt);
      $('#kktInput').addEventListener('keydown', e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); submitKkt(); } });
      $('#callRoomBtn').addEventListener('click', openCall);
      $('#editRoomBtn').addEventListener('click', openRoomEditor);
      $('#cancelRoomEditBtn').addEventListener('click', closeRoomEditor);
      $('#saveRoomEditBtn').addEventListener('click', () => {
        const room = roomById(state.currentRoom);
        state.roomIdentity[room.id] = {name: $('#roomNameInput').value.trim() || room.name, avatar: $('#roomAvatarInput').value.trim() || ''};
        renderChatList(); renderThread(); closeRoomEditor();
      });
      ['openImportBtn','openImportBtnTop'].forEach(id => {
        const el = root.querySelector('#' + (id)); if(el) el.addEventListener('click', () => switchView('st'));
      });
      $('#openEmojiSheetBtn').addEventListener('click', () => { $('#emojiSheet').classList.remove('collapsed'); closeRoomEditor(); });
      $('#closeEmojiSheetBtn').addEventListener('click', () => $('#emojiSheet').classList.add('collapsed'));
      $$('.emoji-btn').forEach(btn => btn.addEventListener('click', () => { $('#kktInput').value += btn.textContent; $('#emojiSheet').classList.add('collapsed'); $('#kktInput').focus(); }));
      $$('.sticker-btn').forEach(btn => btn.addEventListener('click', () => { $('#kktInput').value = btn.textContent.replace(/\s*\(贴纸\)/,''); $('#emojiSheet').classList.add('collapsed'); }));
      $('#applyImportBtn').addEventListener('click', () => { state.defaultImport = $('#stImportText').value; applyImport(state.defaultImport); });
      $('#applyImportBtnTop').addEventListener('click', () => { state.defaultImport = $('#stImportText').value; applyImport(state.defaultImport); });
      $('#resetImportBtn').addEventListener('click', () => { state.defaultImport = defaultImportText; $('#stImportText').value = defaultImportText; applyImport(defaultImportText); });
      $('#muteCallBtn').addEventListener('click', e => e.currentTarget.classList.toggle('active'));
      $('#speakerCallBtn').addEventListener('click', e => e.currentTarget.classList.toggle('active'));
      $('#endCallBtn').addEventListener('click', () => closeCall(true));
      $('#backCallBtn').addEventListener('click', () => closeCall(true));
    }

    function init(){
      state.defaultImport = defaultImportText;
      $('#stImportText').value = defaultImportText;
      applyImport(defaultImportText);
      bindUI();
      updateClock();
      setInterval(updateClock, 1000);
      switchView('lock');
      switchInsPanel('feed');
      switchKktPanel('list');
    }


    // ===== Bridge surface for SillyTavern integration =====
    function refreshFromST({ character, chat } = {}) {
      try {
        if (character && character.name) {
          const room = state.rooms[0];
          if (room) {
            room.name = character.name;
            state.roomIdentity[room.id] = {
              name: character.name,
              avatar: character.avatar || ''
            };
          }
        }
        if (Array.isArray(chat)) {
          const room = state.rooms[0];
          if (room) {
            const charName = character?.name || room.name;
            state.threads[room.id] = chat.map(m => ({
              side: m.is_user ? 'me' : 'other',
              name: m.is_user ? 'me' : (m.from || charName),
              time: (typeof m.time === 'string' && m.time.length >= 5) ? m.time.slice(11,16) : '',
              text: m.text || ''
            }));
            const last = chat[chat.length - 1];
            if (last) {
              room.preview = (last.text || '').slice(0, 40);
              room.time = 'now';
              room.unread = 0;
              room.read = true;
            }
          }
        }
        renderChatList();
        renderThread();
      } catch (e) {
        console.error('[CUI Phone] refreshFromST internal error', e);
      }
    }

    // Expose API for st-bridge.js / external callers
    window.CuiPhone = {
      state,
      applyImport,
      switchView,
      switchKktPanel,
      switchInsPanel,
      renderChatList,
      renderThread,
      renderInstagramFeed: renderFeed,
      openPhonePanel:  () => document.getElementById('cui-phone-root')?.classList.remove('cui-collapsed'),
      closePhonePanel: () => document.getElementById('cui-phone-root')?.classList.add('cui-collapsed'),
      refreshFromST,
      // sendToST() is injected by st-bridge.js
    };

    init();

}
