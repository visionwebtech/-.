 import { escapeHtml, getCurrentUser, isAuthorizedAdminEmail, mapSettingRows, normalizeFeatures, packageSlugToQuery, safeUrl, supabase } from './supabase-client.js';
import { DEFAULT_PACKAGES, DEFAULT_PORTFOLIO, DEFAULT_SERVICES, DEFAULT_SETTINGS } from './default-content.js';

function sortRows(rows = []) {
  return [...rows].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
}

async function fetchVisibleRows(table, fallback, orderField = 'sort_order') {
  try {
    const { data, error } = await supabase.from(table).select('*').eq('is_visible', true).order(orderField, { ascending: true });
    if (error || !Array.isArray(data) || !data.length) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

async function fetchSettings() {
  try {
    const { data, error } = await supabase.from('site_settings').select('*');
    if (error || !Array.isArray(data) || !data.length) return DEFAULT_SETTINGS;
    return mapSettingRows(data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function renderPricingCards(container, packages, { compact = false } = {}) {
  if (!container) return;
  const visiblePackages = sortRows(packages).slice(0, compact ? 3 : packages.length);
  container.innerHTML = visiblePackages.map((pkg) => {
    const slug = packageSlugToQuery(pkg.slug || pkg.name);
    const cleanName = pkg.name.replace(' Website', '');
    const classes = ['pricing-card', 'reveal', pkg.is_featured ? 'featured' : '', slug === 'premium' ? 'premium' : ''].filter(Boolean).join(' ');
    const badge = pkg.is_featured ? '<span class="top-badge">Most Popular</span>' : slug === 'premium' ? '<span class="top-badge alt">Best Value</span>' : '';
    const buttonClass = pkg.is_featured ? 'btn btn-primary full-width' : 'btn btn-secondary full-width';
    const extraMeta = pkg.delivery_time ? `<p class="pricing-meta-line">Delivery: ${escapeHtml(pkg.delivery_time)}</p>` : '';
    return `
      <article class="${classes}">
        ${badge}
        <h3>${escapeHtml(pkg.name)}</h3>
        <p class="pricing-subtitle">${escapeHtml(pkg.description || '')}</p>
        <div class="price">${escapeHtml(pkg.price_text || '')}</div>
        ${extraMeta}
        <ul class="pricing-features">
          ${normalizeFeatures(pkg.features).map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}
        </ul>
        <a class="${buttonClass}" data-order-package="${escapeHtml(cleanName)}" href="order.html?package=${encodeURIComponent(cleanName)}">Choose ${escapeHtml(cleanName)}</a>
      </article>
    `;
  }).join('');
}

function renderHeroPills(container, packages) {
  if (!container) return;
  const visiblePackages = sortRows(packages).slice(0, 3);
  container.innerHTML = visiblePackages.map((pkg) => `<span class="tech-pill">${escapeHtml(pkg.name.replace(' Website', ''))} — ${escapeHtml(pkg.price_text)}</span>`).join('');
}

function renderServices(container, services) {
  if (!container) return;
  container.innerHTML = sortRows(services).map((service, index) => `
    <article class="service-item reveal ${index % 3 === 1 ? 'delay-1' : index % 3 === 2 ? 'delay-2' : ''}">
      <h3>${escapeHtml(service.title)}</h3>
      <p>${escapeHtml(service.description)}</p>
    </article>
  `).join('');
}

function renderPortfolio(container, projects) {
  if (!container) return;
  container.innerHTML = sortRows(projects).map((project, index) => {
    const safeProjectUrl = safeUrl(project.website_url);
    const visual = project.image_url
      ? `<div class="concept-visual external-portfolio-image" style="background-image:url('${String(project.image_url).replace(/'/g, '%27')}');"></div>`
      : `<div class="concept-visual ${(project.category || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'consultant-theme'}"><div class="concept-screen minimal"></div></div>`;
    const link = safeProjectUrl ? `<a class="portfolio-link" href="${safeProjectUrl}" target="_blank" rel="noopener">Open Website</a>` : '<span class="portfolio-link muted">Preview only</span>';
    return `
      <article class="concept-card reveal ${index % 3 === 1 ? 'delay-1' : index % 3 === 2 ? 'delay-2' : ''}">
        <span class="card-badge">${escapeHtml(project.category || 'Portfolio')}</span>
        ${visual}
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.description || '')}</p>
        ${link}
      </article>
    `;
  }).join('');
}

function buildOrderRoute(target = 'order.html') {
  return `auth.html?mode=login&next=${encodeURIComponent(target)}`;
}

async function routeToOrderTarget(target = 'order.html') {
  try {
    const user = await getCurrentUser();
    if (user && isAuthorizedAdminEmail(user.email)) {
      window.location.href = 'admin-dashboard.html';
      return;
    }
    if (user) {
      window.location.href = target;
      return;
    }
  } catch (error) {
    console.error(error);
  }

  window.location.href = buildOrderRoute(target);
}

function ensureFloatingOrderButton() {
  const pathName = window.location.pathname.split('/').pop() || 'index.html';
  const blockedPages = new Set(['admin-dashboard.html', 'admin-login.html', 'customer-dashboard.html']);
  if (blockedPages.has(pathName)) return;
  if (document.querySelector('.floating-order')) return;

  const button = document.createElement('a');
  button.className = 'floating-order';
  button.href = 'order.html';
  button.setAttribute('data-order-target', 'order.html');
  button.setAttribute('aria-label', 'Start your website order');
  button.innerHTML = '<span class="floating-icon">➜</span><span>Order Now</span>';
  document.body.appendChild(button);
}

function initOrderActionLinks() {
  ensureFloatingOrderButton();

  document.querySelectorAll('[data-order-package], [data-order-target]').forEach((link) => {
    link.addEventListener('click', async (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();

      const packageName = link.getAttribute('data-order-package');
      const explicitTarget = link.getAttribute('data-order-target');
      const target = explicitTarget || `order.html?package=${encodeURIComponent(packageName || 'Business')}`;
      await routeToOrderTarget(target);
    });
  });
}

function updateSettingDrivenContent(settings) {
  document.querySelectorAll('[data-contact-phone-text]').forEach((el) => {
    el.textContent = settings.business_phone;
  });

  document.querySelectorAll('[data-contact-email-text]').forEach((el) => {
    el.textContent = settings.business_email;
  });

  document.querySelectorAll('[data-contact-instagram-text]').forEach((el) => {
    el.textContent = settings.instagram_handle;
  });

  document.querySelectorAll('[data-primary-cta-text]').forEach((el) => {
    el.textContent = settings.primary_cta_text;
  });

  document.querySelectorAll('[data-link-type="phone"]').forEach((el) => {
    el.setAttribute('href', `tel:${settings.business_phone.replace(/\s+/g, '')}`);
  });

  document.querySelectorAll('[data-link-type="email"]').forEach((el) => {
    el.setAttribute('href', `mailto:${settings.business_email}`);
  });

  document.querySelectorAll('[data-link-type="instagram"]').forEach((el) => {
    el.setAttribute('href', settings.instagram_url);
  });

  document.querySelectorAll('[data-link-type="whatsapp"]').forEach((el) => {
    const preset = el.getAttribute('data-whatsapp-message');
    const href = preset
      ? `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(preset)}`
      : `https://wa.me/${settings.whatsapp_number}`;
    el.setAttribute('href', href);
  });

  const contactHeading = document.querySelector('[data-contact-heading]');
  if (contactHeading) contactHeading.textContent = settings.contact_heading;
  const contactIntro = document.querySelector('[data-contact-intro]');
  if (contactIntro) contactIntro.textContent = settings.contact_intro;
}

async function bootSiteData() {
  const [packages, services, projects, settings] = await Promise.all([
    fetchVisibleRows('pricing_packages', DEFAULT_PACKAGES),
    fetchVisibleRows('services_content', DEFAULT_SERVICES),
    fetchVisibleRows('portfolio_projects', DEFAULT_PORTFOLIO),
    fetchSettings()
  ]);

  renderHeroPills(document.querySelector('[data-pricing-hero-pills]'), packages);
  renderPricingCards(document.querySelector('[data-pricing-grid]'), packages, { compact: false });
  renderPricingCards(document.querySelector('[data-pricing-preview-grid]'), packages, { compact: true });
  renderServices(document.querySelector('[data-services-grid]'), services);
  renderPortfolio(document.querySelector('[data-portfolio-grid]'), projects);
  updateSettingDrivenContent(settings);
  initOrderActionLinks();

  document.querySelectorAll('.reveal').forEach((item) => {
    if (!item.classList.contains('in-view') && item.getBoundingClientRect().top < window.innerHeight) {
      item.classList.add('in-view');
    }
  });
}

bootSiteData();
