let currentMode = 'login';
let loginRole = 'customer';

// ─── Utility: Toast Notification ─────────────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'error')   toast.style.background = '#dc2626';
    if (type === 'warning') toast.style.background = '#d97706';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3000);
}

// ─── Utility: Loading Skeleton ────────────────────────────────────────────────
function showSkeleton(containerId, rows = 3) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Array.from({ length: rows }, () =>
        `<div class="skeleton-card"><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>`
    ).join('');
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────
function checkLogin() {
    const role    = localStorage.getItem('userRole');
    const email   = localStorage.getItem('userEmail');
    const authBtn = document.getElementById('nav-auth-btn');
    if (role && authBtn) {
        authBtn.textContent = 'Dashboard';
        authBtn.href = role === 'admin' ? 'admin.html' : 'customer.html';
    }
    const subscribeWidget = document.getElementById('index-subscribe-widget');
    if (subscribeWidget && role === 'admin') subscribeWidget.style.display = 'none';

    // Hide guest-only elements when already logged in
    if (role) {
        const heroCta = document.getElementById('hero-cta');
        if (heroCta) heroCta.style.display = 'none';
        const writeForUs = document.getElementById('write-for-us-widget');
        if (writeForUs) writeForUs.style.display = 'none';
    }

    // Personalize customer header
    const welcomeHeading = document.getElementById('customer-welcome-name');
    if (welcomeHeading && email) {
        const displayName = email.split('@')[0];
        welcomeHeading.textContent = `Welcome back, ${displayName}!`;
    }
    // Show email badge in customer nav
    const emailBadge = document.getElementById('user-email-badge');
    if (emailBadge && email) emailBadge.textContent = email;
}

function logout() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
}

// ─── Index: Load Published Posts ──────────────────────────────────────────────
async function loadIndexPosts() {
    const trendingGrid = document.getElementById('trending-articles-grid');
    if (!trendingGrid) return;
    showSkeleton('trending-articles-grid', 3);
    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();
        if (posts.error) {
            trendingGrid.innerHTML = `<p style="color:red;">Database Error: ${posts.error}</p>`;
            return;
        }
        trendingGrid.innerHTML = '';
        const publishedPosts = posts.filter(post => post.status === 'Published');
        if (publishedPosts.length > 0) {
            let i = 0;
            do {
                const post = publishedPosts[i];
                const words = post.content.split(/\s+/).length;
                const readingTime = Math.ceil(words / 200);
                const snippet = post.content.replace(/["\n]/g, ' ').substring(0, 110);
                const card = document.createElement('div');
                card.className = 'card card-hover';
                card.style.borderLeft = '4px solid var(--action-blue)';
                card.innerHTML = `
                    <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--action-blue); font-weight:bold;">Insight Piece</span>
                    <h3 style="margin: 0.5rem 0;"><a href="post-detail.html?id=${post.id}">${post.title}</a></h3>
                    <p style="color:#475569; font-size:0.95rem; margin-bottom:1rem;">${snippet}...</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:#64748b;">
                        <span>By ScribeHub Staff</span>
                        <span>📖 ${readingTime} min read</span>
                    </div>
                `;
                trendingGrid.appendChild(card);
                i++;
            } while (i < publishedPosts.length);
        } else {
            trendingGrid.innerHTML = '<p style="color:#64748b; padding:1rem;">No published articles yet. Check back soon!</p>';
        }
    } catch (err) {
        trendingGrid.innerHTML = '<p style="color:#dc2626;">Could not connect to server. Make sure it is running on port 3000.</p>';
    }
}

// ─── Admin: Load Posts Table ──────────────────────────────────────────────────
async function loadAdminPosts() {
    const tableBody = document.querySelector('.data-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#64748b; padding:2rem;">Loading posts...</td></tr>`;
    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();
        if (posts.error) return;
        tableBody.innerHTML = '';
        if (posts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#64748b; padding:2rem;">No posts yet. <a href="editor.html">Write your first post →</a></td></tr>`;
            return;
        }
        posts.forEach(post => {
            const row = document.createElement('tr');
            row.className = 'post-row';
            const statusClass = post.status.toLowerCase() === 'published' ? 'pub-btn' : 'draft-btn';
            const statusIcon  = post.status === 'Published' ? '✅' : '📝';
            row.innerHTML = `
                <td><strong>${post.title}</strong></td>
                <td>
                    <button
                        class="status-toggle ${statusClass}"
                        title="Click to toggle status"
                        onclick="togglePostStatus(${post.id}, '${post.status}')">
                        ${statusIcon} ${post.status}
                    </button>
                </td>
                <td>
                    <a href="editor.html?id=${post.id}" style="margin-right:0.5rem;">✏️ Edit</a>
                    <button onclick="deletePost(${post.id})" style="color:red; background:none; border:none; cursor:pointer;">🗑 Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {}
}

// NEW: Toggle post status via PATCH endpoint
async function togglePostStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Published' ? 'Draft' : 'Published';
    try {
        const response = await fetch(`/api/posts/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const result = await response.json();
        if (result.success) {
            showToast(`Post ${newStatus === 'Published' ? 'published ✅' : 'moved to Draft 📝'}`);
            loadAdminPosts();
            updateDashboardStats();
        } else {
            showToast('Error updating status: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('Server error. Make sure the server is running.', 'error');
    }
}

async function deletePost(id) {
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    try {
        const response = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
            showToast('Post deleted successfully.');
            loadAdminPosts();
            updateDashboardStats();
        } else {
            showToast('Error deleting post: ' + result.error, 'error');
        }
    } catch (err) {
        showToast('Server error occurred.', 'error');
    }
}

// ─── Admin: Dashboard Stats ───────────────────────────────────────────────────
async function updateDashboardStats() {
    const viewsEl         = document.getElementById('stat-views');
    const subsEl          = document.getElementById('stat-subscribers');
    const totalPostsEl    = document.getElementById('stat-total-posts');
    const publishedEl     = document.getElementById('stat-published');
    const draftEl         = document.getElementById('stat-drafts');
    const bookmarksEl     = document.getElementById('stat-bookmarks');
    const newsletterSubCount = document.getElementById('newsletter-sub-count');

    try {
        const response = await fetch('/api/analytics');
        const data = await response.json();
        if (data && data.totalUsers != null) {
            if (viewsEl)      viewsEl.textContent      = Number(data.totalUsers).toLocaleString();
            if (subsEl)       subsEl.textContent        = Number(data.subscribers).toLocaleString();
            if (totalPostsEl) totalPostsEl.textContent  = Number(data.totalPosts).toLocaleString();
            if (publishedEl)  publishedEl.textContent   = Number(data.publishedPosts).toLocaleString();
            if (draftEl)      draftEl.textContent       = Number(data.draftPosts).toLocaleString();
            if (bookmarksEl)  bookmarksEl.textContent   = Number(data.totalBookmarks).toLocaleString();
            if (newsletterSubCount) newsletterSubCount.textContent = Number(data.subscribers).toLocaleString();
        }
    } catch (err) {
        console.error('Failed to fetch analytics:', err);
    }
}

// ─── Subscription ─────────────────────────────────────────────────────────────
async function loadSubscriptionStatus() {
    const badge     = document.getElementById('sub-status-badge');
    const actionBtn = document.getElementById('sub-action-btn');
    if (!badge) return;
    const email = localStorage.getItem('userEmail');
    if (!email) {
        badge.textContent = 'Not Subscribed';
        badge.className = 'badge draft-btn';
        if (actionBtn) actionBtn.textContent = 'Buy Subscription';
        return;
    }
    try {
        const res  = await fetch(`/api/subscription/${email}`);
        const data = await res.json();
        const isActive = data.subscribed === true;
        if (isActive) {
            badge.textContent = '✅ Active';
            badge.className = 'badge pub-btn';
            if (actionBtn) actionBtn.textContent = 'Cancel Subscription';
        } else {
            badge.textContent = 'Not Subscribed';
            badge.className = 'badge draft-btn';
            if (actionBtn) actionBtn.textContent = 'Buy Subscription';
        }
    } catch (err) {
        badge.textContent = 'Not Subscribed';
        badge.className = 'badge draft-btn';
        if (actionBtn) actionBtn.textContent = 'Buy Subscription';
    }
}

async function toggleSubscription() {
    const email = localStorage.getItem('userEmail');
    if (!email) { window.location.href = 'login.html'; return; }
    const badge     = document.getElementById('sub-status-badge');
    const actionBtn = document.getElementById('sub-action-btn');
    const currentlyActive = badge && badge.textContent.includes('Active');
    const newStatus = !currentlyActive;
    if (!newStatus && !confirm('Are you sure you want to cancel your subscription?')) return;

    if (actionBtn) { actionBtn.textContent = 'Updating...'; actionBtn.disabled = true; }
    try {
        const res  = await fetch('/api/subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, subscribed: newStatus })
        });
        const data = await res.json();
        if (data.success) {
            if (newStatus) {
                if (badge)     { badge.textContent = '✅ Active'; badge.className = 'badge pub-btn'; }
                if (actionBtn) { actionBtn.textContent = 'Cancel Subscription'; }
                showToast('Subscription activated! Welcome to ScribeHub Weekly. 🎉');
            } else {
                if (badge)     { badge.textContent = 'Not Subscribed'; badge.className = 'badge draft-btn'; }
                if (actionBtn) { actionBtn.textContent = 'Buy Subscription'; }
                showToast('Subscription cancelled.', 'warning');
            }
            updateDashboardStats();
        }
    } catch (err) {
        showToast('Subscription update failed. Try again.', 'error');
    } finally {
        if (actionBtn) actionBtn.disabled = false;
    }
}

// ─── Newsletter Blast ─────────────────────────────────────────────────────────
async function blastNewsletter() {
    const countEl = document.getElementById('newsletter-sub-count');
    const count   = countEl ? parseInt(countEl.textContent) || 0 : 0;
    if (count === 0) {
        showToast('No active subscribers yet to send to.', 'warning');
        return;
    }
    if (confirm(`📧 Send newsletter blast to ${count} subscriber(s)?\n\nThis will notify all active subscribers.`)) {
        showToast(`✅ Newsletter blasted to ${count} subscriber(s)!`);
    }
}

// ─── Editor ───────────────────────────────────────────────────────────────────
async function loadEditorData() {
    const titleInput   = document.getElementById('editor-title-input');
    const contentInput = document.getElementById('editor-content-input');
    const statusSelect = document.getElementById('editor-status-select');
    if (!titleInput || !contentInput || !statusSelect) return;
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    if (postId) {
        titleInput.placeholder = 'Loading...';
        try {
            const response = await fetch(`/api/posts/${postId}`);
            const post = await response.json();
            titleInput.value   = post.title;
            contentInput.value = post.content;
            statusSelect.value = post.status;
            titleInput.placeholder = 'Post Title...';
            updateWordCount();
        } catch (err) {
            console.error('Failed to load post for editing', err);
        }
    }
}

// NEW: Live word/char counter for editor
function updateWordCount() {
    const contentInput  = document.getElementById('editor-content-input');
    const wordCountEl   = document.getElementById('editor-word-count');
    const charCountEl   = document.getElementById('editor-char-count');
    const readTimeEl    = document.getElementById('editor-read-time');
    if (!contentInput) return;
    const text  = contentInput.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = contentInput.value.length;
    const readTime = Math.ceil(words / 200);
    if (wordCountEl) wordCountEl.textContent = `${words.toLocaleString()} words`;
    if (charCountEl) charCountEl.textContent = `${chars.toLocaleString()} chars`;
    if (readTimeEl)  readTimeEl.textContent  = `~${readTime} min read`;
}

// NEW: Auto-save draft to localStorage
let autoSaveTimer = null;
function scheduleAutoSave() {
    const indicator = document.getElementById('autosave-indicator');
    if (indicator) { indicator.textContent = 'Unsaved changes...'; indicator.style.color = '#d97706'; }
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        const title   = document.getElementById('editor-title-input')?.value;
        const content = document.getElementById('editor-content-input')?.value;
        if (title || content) {
            localStorage.setItem('autosave_title',   title   || '');
            localStorage.setItem('autosave_content', content || '');
            if (indicator) { indicator.textContent = '✅ Draft auto-saved'; indicator.style.color = '#166534'; }
            setTimeout(() => { if (indicator) indicator.textContent = ''; }, 3000);
        }
    }, 2000);
}

// ─── Customer: Saved Articles ─────────────────────────────────────────────────
async function loadSavedArticles() {
    const savedGrid = document.getElementById('saved-articles-grid');
    if (!savedGrid) return;
    const email = localStorage.getItem('userEmail');
    if (!email) {
        savedGrid.innerHTML = '<p style="color:#64748b;">Please <a href="login.html">log in</a> to view saved articles.</p>';
        return;
    }
    showSkeleton('saved-articles-grid', 2);
    try {
        const response = await fetch(`/api/bookmarks/${email}`);
        const posts = await response.json();
        savedGrid.innerHTML = '';
        if (posts.length > 0) {
            let i = 0;
            do {
                const post = posts[i];
                const words = post.content.split(/\s+/).length;
                const readingTime = Math.ceil(words / 200);
                const card = document.createElement('div');
                card.className = 'card card-hover';
                card.innerHTML = `
                    <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--action-blue); font-weight:bold;">Saved Article</span>
                    <h3 style="margin:0.5rem 0;"><a href="post-detail.html?id=${post.id}">${post.title}</a></h3>
                    <p style="color:#475569; font-size:0.9rem; margin:0.5rem 0;">${post.content.substring(0, 100).replace(/\n/g, ' ')}...</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem;">
                        <span style="font-size:0.8rem; color:#64748b;">📖 ${readingTime} min read</span>
                        <button class="btn-outline" style="padding:0.4rem 1rem; font-size:0.85rem;" onclick="toggleBookmark(${post.id}, true)">🗑 Remove</button>
                    </div>
                `;
                savedGrid.appendChild(card);
                i++;
            } while (i < posts.length);
        } else {
            savedGrid.innerHTML = `
                <div class="card" style="text-align:center; padding:3rem; color:#64748b;">
                    <p style="font-size:1.2rem; margin-bottom:0.5rem;">📚 No saved articles yet.</p>
                    <p>Browse articles and bookmark them to find them here.</p>
                    <a href="index.html" class="btn-action" style="display:inline-block; margin-top:1rem;">Browse Articles →</a>
                </div>
            `;
        }
    } catch (err) {}
}

async function toggleBookmark(postId, reloadOnSuccess = false) {
    const email = localStorage.getItem('userEmail');
    if (!email) { window.location.href = 'login.html'; return; }
    try {
        const bmRes = await fetch(`/api/bookmarks/${email}`);
        const bms   = await bmRes.json();
        const isBookmarked = bms.some(b => b.id == postId);
        const method = isBookmarked ? 'DELETE' : 'POST';
        await fetch('/api/bookmarks', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, postId })
        });
        if (reloadOnSuccess) {
            showToast(isBookmarked ? 'Bookmark removed.' : '📌 Article bookmarked!');
            setTimeout(() => window.location.reload(), 800);
        }
    } catch (err) {}
}

// ─── Post Detail ──────────────────────────────────────────────────────────────
async function loadPostDetail() {
    const postBody   = document.querySelector('.post-body');
    const relatedGrid = document.getElementById('related-posts-grid');
    if (!postBody) return;
    postBody.innerHTML = `<div style="text-align:center; padding:4rem; color:#64748b;"><div class="spinner"></div><p style="margin-top:1rem;">Loading article...</p></div>`;
    const urlParams = new URLSearchParams(window.location.search);
    const postId    = urlParams.get('id');
    const email     = localStorage.getItem('userEmail');
    const userRole  = localStorage.getItem('userRole');
    try {
        const response = await fetch('/api/posts');
        const posts = await response.json();
        if (posts.error) return;
        const currentPost = posts.find(p => p.id == postId) || posts[0];
        let bookmarkBtnHtml = '';
        if (userRole === 'admin') {
            bookmarkBtnHtml = `<a href="editor.html?id=${currentPost.id}" class="btn-action mt-2" style="display:inline-block;">✏️ Edit Article</a>`;
        } else if (email) {
            try {
                const bmRes = await fetch(`/api/bookmarks/${email}`);
                const bms   = await bmRes.json();
                if (!bms.error) {
                    const isBookmarked = bms.some(b => b.id == currentPost.id);
                    const btnText = isBookmarked ? '🗑 Remove Bookmark' : '📌 Bookmark Article';
                    bookmarkBtnHtml = `<button class="btn-action mt-2" onclick="toggleBookmark(${currentPost.id}, true)">${btnText}</button>`;
                }
            } catch (e) {}
        } else {
            bookmarkBtnHtml = `<a href="login.html" class="btn-outline mt-2" style="display:inline-block;">Login to Bookmark</a>`;
        }
        if (currentPost) {
            const paragraphs = currentPost.content.split('\n\n');
            let formattedBodyHtml = '';
            let p = 0;
            do {
                const paraText = paragraphs[p].trim();
                if (paraText.startsWith('"') && paraText.endsWith('"')) {
                    formattedBodyHtml += `
                        <blockquote style="border-left: 4px solid var(--action-blue); padding-left: 1.5rem; font-style: italic; font-size: 1.3rem; color: #334155; margin: 2rem 0; font-family: Georgia, serif;">
                            ${paraText}
                        </blockquote>
                    `;
                } else if (p === 0) {
                    formattedBodyHtml += `
                        <p class="serif-text" style="font-size: 1.25rem; line-height: 1.7; color: #0f172a; font-weight: 500; margin-bottom: 1.5rem;">
                            ${paraText}
                        </p>
                    `;
                } else {
                    formattedBodyHtml += `
                        <p class="serif-text" style="color: #334155; margin-bottom: 1.5rem;">
                            ${paraText}
                        </p>
                    `;
                }
                p++;
            } while (p < paragraphs.length);
            const words = currentPost.content.split(/\s+/).length;
            const readingTime = Math.ceil(words / 200);
            // Update page title
            document.title = `${currentPost.title} | ScribeHub`;
            postBody.innerHTML = `
                <div style="border-bottom: 1px solid var(--light-gray); padding-bottom: 1.5rem; margin-bottom: 2rem;">
                    <span style="font-size: 0.85rem; font-weight: bold; text-transform: uppercase; color: var(--action-blue); letter-spacing: 1px;">Digital Systems Series</span>
                    <h1 style="font-size: 2.75rem; line-height: 1.2; margin-top: 0.5rem; margin-bottom: 1rem; font-weight: 800;">${currentPost.title}</h1>
                    <div style="display: flex; align-items: center; gap: 1rem; font-size: 0.9rem; color: #64748b;">
                        <div style="width: 40px; height: 40px; background: var(--action-blue); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">SH</div>
                        <div>
                            <p style="margin: 0; font-weight: bold; color: var(--deep-slate);">Written by ScribeHub Analytics</p>
                            <p style="margin: 0; font-size: 0.8rem;">Published Analyst • 📖 ${readingTime} min read • ${words.toLocaleString()} words</p>
                        </div>
                    </div>
                </div>
                <div style="font-size: 1.15rem; line-height: 1.8;">
                    ${formattedBodyHtml}
                </div>
                <div style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--light-gray);">
                    ${bookmarkBtnHtml}
                </div>
            `;
        }
        if (relatedGrid) {
            relatedGrid.innerHTML = '';
            const otherPosts = posts.filter(p => p.id != currentPost.id && p.status === 'Published');
            let count = 0, i = 0;
            if (otherPosts.length > 0) {
                do {
                    const post = otherPosts[i];
                    const card = document.createElement('div');
                    card.className = 'card card-hover';
                    card.style.cursor = 'pointer';
                    card.onclick = () => { window.location.href = `post-detail.html?id=${post.id}`; };
                    card.innerHTML = `
                        <h4 style="margin:0;"><a href="post-detail.html?id=${post.id}" style="color:var(--deep-slate); text-decoration:none;">${post.title}</a></h4>
                        <span style="font-size:0.75rem; color:var(--action-blue); font-weight:bold; display:block; margin-top:0.5rem;">Read Now →</span>
                    `;
                    relatedGrid.appendChild(card);
                    count++; i++;
                } while (i < otherPosts.length && count < 2);
            } else {
                relatedGrid.innerHTML = '<p style="color:#64748b;">No other articles available.</p>';
            }
        }
    } catch (err) {
        postBody.innerHTML = '<p style="color:#dc2626;">Could not load article. Is the server running?</p>';
    }
}

// ─── DOMContentLoaded ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
    loadIndexPosts();
    loadAdminPosts();
    loadSavedArticles();
    loadPostDetail();
    loadEditorData();
    updateDashboardStats();
    loadSubscriptionStatus();

    // Auto-refresh analytics every 30s on admin page
    if (document.getElementById('stat-views')) {
        setInterval(updateDashboardStats, 30000);
    }

    // Newsletter form toast
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            showToast('✅ You are now subscribed to ScribeHub!');
            this.reset();
        });
    }

    // Tab navigation
    const tabBtns  = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    if (tabBtns.length > 0) {
        let i = 0;
        do {
            const btn = tabBtns[i];
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                if (!target) return;
                let j = 0;
                do { tabPanes[j].style.display = 'none'; j++; } while (j < tabPanes.length);
                let k = 0;
                do { tabBtns[k].classList.remove('active'); k++; } while (k < tabBtns.length);
                const targetPane = document.getElementById(target);
                if (targetPane) targetPane.style.display = 'block';
                btn.classList.add('active');
            });
            i++;
        } while (i < tabBtns.length);
    }

    // Search posts (admin)
    const searchInput = document.getElementById('search-post');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('.post-row');
            let r = 0;
            do {
                const title = rows[r].querySelector('td').textContent.toLowerCase();
                rows[r].style.display = title.includes(term) ? '' : 'none';
                r++;
            } while (r < rows.length);
        });
    }

    // Publish modal
    const publishBtn       = document.getElementById('publish-btn');
    const modal            = document.getElementById('publish-modal');
    const closeModalBtn    = document.getElementById('close-modal');
    const confirmPublishBtn = document.getElementById('confirm-publish-btn');
    const statusSelect     = document.getElementById('editor-status-select');

    if (publishBtn && modal) publishBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    if (confirmPublishBtn) {
        confirmPublishBtn.addEventListener('click', async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const postId    = urlParams.get('id');
            const title     = document.getElementById('editor-title-input').value.trim();
            const content   = document.getElementById('editor-content-input').value.trim();
            const status    = statusSelect.value;
            if (!title) { showToast('Please enter a title before saving.', 'warning'); return; }
            if (!content) { showToast('Content cannot be empty.', 'warning'); return; }
            confirmPublishBtn.textContent = 'Saving...';
            confirmPublishBtn.disabled = true;
            const endpoint = postId ? `/api/posts/${postId}` : '/api/posts';
            const method   = postId ? 'PUT' : 'POST';
            try {
                const response = await fetch(endpoint, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, status })
                });
                const result = await response.json();
                if (result.success) {
                    localStorage.removeItem('autosave_title');
                    localStorage.removeItem('autosave_content');
                    showToast('✅ Post saved successfully!');
                    setTimeout(() => { window.location.href = 'admin.html'; }, 800);
                } else {
                    showToast('Error: ' + result.error, 'error');
                }
            } catch (err) {
                showToast('Server error occurred.', 'error');
            } finally {
                confirmPublishBtn.textContent = 'Save Changes';
                confirmPublishBtn.disabled = false;
            }
        });
    }

    // Editor word count + auto-save
    const editorContent = document.getElementById('editor-content-input');
    const editorTitle   = document.getElementById('editor-title-input');
    if (editorContent) {
        editorContent.addEventListener('input', () => { updateWordCount(); scheduleAutoSave(); });
    }
    if (editorTitle) {
        editorTitle.addEventListener('input', scheduleAutoSave);
    }

    // Login / signup form
    const loginForm    = document.getElementById('login-form');
    const loginToggles = document.querySelectorAll('.login-toggle');
    const authModeBtn  = document.getElementById('btn-auth-mode');
    const authTitle    = document.getElementById('auth-title');
    const submitBtn    = document.getElementById('btn-submit');

    if (loginToggles.length > 0) {
        let t = 0;
        do {
            loginToggles[t].addEventListener('click', function(e) {
                let k = 0;
                do { loginToggles[k].classList.remove('active-toggle'); k++; } while (k < loginToggles.length);
                e.target.classList.add('active-toggle');
                loginRole = e.target.dataset.role;
                if (loginRole === 'admin') {
                    currentMode = 'login';
                    if (authTitle) authTitle.textContent = 'Sign In';
                    if (submitBtn) submitBtn.textContent = 'Sign In';
                    if (authModeBtn) authModeBtn.style.display = 'none';
                } else {
                    if (authModeBtn) authModeBtn.style.display = 'block';
                }
            });
            t++;
        } while (t < loginToggles.length);
    }

    if (authModeBtn) {
        authModeBtn.addEventListener('click', () => {
            if (currentMode === 'login') {
                currentMode = 'signup';
                if (authTitle) authTitle.textContent = 'Sign Up';
                if (submitBtn) submitBtn.textContent = 'Register';
                authModeBtn.textContent = 'Already have an account? Sign In';
            } else {
                currentMode = 'login';
                if (authTitle) authTitle.textContent = 'Sign In';
                if (submitBtn) submitBtn.textContent = 'Sign In';
                authModeBtn.textContent = 'Need an account? Sign Up';
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const emailInput    = document.getElementById('email-input').value;
            const passwordInput = document.getElementById('password-input').value;
            const endpoint  = currentMode === 'login' ? '/api/login' : '/api/signup';
            const payload   = { email: emailInput, password: passwordInput, role: loginRole };
            const btn = document.getElementById('btn-submit');
            if (btn) { btn.textContent = 'Please wait...'; btn.disabled = true; }
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (data.success) {
                    if (currentMode === 'signup') {
                        showToast('✅ Account created! Please sign in.');
                        currentMode = 'login';
                        if (authTitle) authTitle.textContent = 'Sign In';
                        if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
                        if (authModeBtn) authModeBtn.textContent = 'Need an account? Sign Up';
                    } else {
                        localStorage.setItem('userRole',  data.role);
                        localStorage.setItem('userEmail', data.email);
                        showToast(`Welcome back! Redirecting...`);
                        setTimeout(() => {
                            window.location.href = data.role === 'admin' ? 'admin.html' : 'customer.html';
                        }, 600);
                    }
                } else {
                    showToast('Error: ' + (data.error || 'Invalid credentials'), 'error');
                    if (btn) { btn.textContent = currentMode === 'login' ? 'Sign In' : 'Register'; btn.disabled = false; }
                }
            } catch (err) {
                showToast('Cannot connect to server. Is it running?', 'error');
                if (btn) { btn.textContent = currentMode === 'login' ? 'Sign In' : 'Register'; btn.disabled = false; }
            }
        });
    }

    // Scroll progress bar
    window.addEventListener('scroll', () => {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            const scrollTotal = document.documentElement.scrollTop;
            const heightTotal = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            progressBar.style.width = ((scrollTotal / heightTotal) * 100) + '%';
        }
    });
});