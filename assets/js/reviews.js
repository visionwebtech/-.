const STORAGE_KEY = 'vwt-reviews-v1';
const MAX_REVIEWS = 30;
const MAX_IMAGE_BYTES = 350_000;

function escape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function starsMarkup(rating) {
  const full = Math.round(Number(rating) || 0);
  let html = '';
  for (let i = 1; i <= 5; i += 1) html += i <= full ? '★' : '☆';
  return html;
}

async function compressImage(file) {
  if (!file || !file.type?.startsWith('image/')) return '';
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const scale = Math.min(1, 800 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.82;
  let output = canvas.toDataURL('image/jpeg', quality);
  while (output.length > MAX_IMAGE_BYTES && quality > 0.45) {
    quality -= 0.08;
    output = canvas.toDataURL('image/jpeg', quality);
  }
  return output;
}

function loadReviews() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReviews(reviews) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews.slice(0, MAX_REVIEWS)));
  } catch {
    /* quota or privacy mode */
  }
}

function makeInitialCards() {
  const section = document.querySelector('.review-section');
  if (!section) return null;
  const list = section.querySelector('.review-list');
  const empty = section.querySelector('.review-empty');
  if (!list) return null;
  return { section, list, empty };
}

function render() {
  const ctx = makeInitialCards();
  if (!ctx) return;
  const reviews = loadReviews();
  ctx.list.innerHTML = '';
  if (!reviews.length) {
    ctx.empty.hidden = false;
    return;
  }
  ctx.empty.hidden = true;
  reviews.forEach((review) => {
    const item = document.createElement('article');
    item.className = 'review-card';
    item.innerHTML = `
      <header class="review-card-head">
        <div class="review-avatar" aria-hidden="true">${escape((review.name || '?').trim().charAt(0).toUpperCase())}</div>
        <div class="review-meta">
          <strong>${escape(review.name)}</strong>
          <span class="review-stars" aria-label="${review.rating} out of 5 stars">${starsMarkup(review.rating)}</span>
          <span class="review-date">${escape(review.date)}</span>
        </div>
      </header>
      <p class="review-body">${escape(review.description)}</p>
      ${review.image ? `<img src="${review.image}" alt="Uploaded image for review by ${escape(review.name)}" class="review-photo">` : ''}
    `;
    ctx.list.appendChild(item);
  });
}

function bindStarField() {
  const stars = document.querySelectorAll('[data-star-target] button');
  const input = document.querySelector('[data-star-input]');
  const live = document.querySelector('[data-star-live]');
  if (!stars.length || !input) return;
  let current = Number(input.value) || 0;
  const paint = (val) => {
    stars.forEach((btn) => {
      const v = Number(btn.dataset.value);
      btn.classList.toggle('is-on', v <= val);
      btn.setAttribute('aria-pressed', String(v <= val));
    });
  };
  paint(current);
  stars.forEach((btn) => {
    btn.addEventListener('click', () => {
      current = Number(btn.dataset.value);
      input.value = String(current);
      if (live) live.textContent = `${current} of 5 stars`;
      paint(current);
    });
    btn.addEventListener('keydown', (event) => {
      const v = Number(btn.dataset.value);
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        current = Math.min(5, v + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        current = Math.max(1, v - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        current = v;
      } else {
        return;
      }
      input.value = String(current);
      if (live) live.textContent = `${current} of 5 stars`;
      paint(current);
    });
  });
}

async function handleSubmit(form) {
  const status = form.querySelector('[data-review-status]');
  const name = form.querySelector('[name="name"]')?.value.trim();
  const email = form.querySelector('[name="email"]')?.value.trim();
  const rating = Number(form.querySelector('[name="rating"]')?.value || 0);
  const description = form.querySelector('[name="description"]')?.value.trim();
  const file = form.querySelector('[name="photo"]')?.files?.[0];

  if (!name || !email || !rating || !description) {
    status.textContent = 'Please complete name, email, star rating and review before submitting.';
    status.dataset.type = 'error';
    return;
  }
  if (rating < 1 || rating > 5) {
    status.textContent = 'Select a star rating between 1 and 5.';
    status.dataset.type = 'error';
    return;
  }

  status.textContent = 'Saving your review...';
  status.dataset.type = 'loading';
  const image = await compressImage(file);

  const entry = {
    name,
    email,
    rating,
    description,
    image,
    date: new Date().toISOString()
  };

  const reviews = [entry, ...loadReviews()].slice(0, MAX_REVIEWS);
  saveReviews(reviews);
  form.reset();
  const starInput = form.querySelector('[name="rating"]');
  if (starInput) starInput.value = '0';
  const live = form.querySelector('[data-star-live]');
  if (live) live.textContent = '0 of 5 stars';
  document.querySelectorAll('[data-star-target] button').forEach((b) => {
    b.classList.remove('is-on');
    b.setAttribute('aria-pressed', 'false');
  });
  status.textContent = 'Thank you — your review has been published below.';
  status.dataset.type = 'success';
  render();
}

function init() {
  const form = document.querySelector('[data-review-form]');
  if (!form) return;
  bindStarField();
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSubmit(form).catch(() => {
      const status = form.querySelector('[data-review-status]');
      if (status) {
        status.textContent = 'Could not save your review right now.';
        status.dataset.type = 'error';
      }
    });
  });
  render();
}

document.addEventListener('DOMContentLoaded', init);
