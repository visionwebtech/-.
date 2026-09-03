 import { supabase, getAuthRedirectTarget, getCurrentUser, isAuthorizedAdminEmail } from './supabase-client.js';

const authForms = {
  login: document.querySelector('[data-login-form]'),
  signup: document.querySelector('[data-signup-form]')
};
const authTabs = document.querySelectorAll('[data-auth-tab]');
const authPanels = document.querySelectorAll('[data-auth-panel]');
const globalStatus = document.querySelector('[data-auth-global-status]');
const modeLabel = document.querySelector('[data-current-mode-label]');

function setStatus(message, type = 'info') {
  if (!globalStatus) return;
  globalStatus.textContent = message;
  globalStatus.className = `form-status ${type}`;
}

function showPanel(mode) {
  authTabs.forEach((tab) => {
    tab.classList.toggle('active-toggle', tab.dataset.authTab === mode);
  });
  authPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.authPanel !== mode);
  });
  if (modeLabel) modeLabel.textContent = mode === 'signup' ? 'Create your account' : 'Sign in to continue';
}

async function handleExistingSession() {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    if (isAuthorizedAdminEmail(user.email)) {
      window.location.replace('admin-dashboard.html');
      return;
    }
    window.location.replace(getAuthRedirectTarget('customer-dashboard.html'));
  } catch (error) {
    console.error(error);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const form = authForms.signup;
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const fullName = form.querySelector('[name="fullName"]')?.value.trim() || '';
  const email = form.querySelector('[name="email"]')?.value.trim() || '';
  const password = form.querySelector('[name="password"]')?.value || '';

  if (!fullName || !email || !password) {
    setStatus('Please complete all sign up fields.', 'error');
    return;
  }

  button.disabled = true;
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.textContent = 'Creating Account...';
  setStatus('Creating your customer account...', 'loading');

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;

    let activeSession = data.session || null;

    if (!activeSession) {
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setStatus('Account created. Please confirm your email if required, then log in with your email and password.', 'success');
        showPanel('login');
        const loginEmailField = authForms.login?.querySelector('[name="email"]');
        if (loginEmailField && !loginEmailField.value) loginEmailField.value = email;
        return;
      }
      activeSession = loginData.session || null;
    }

    if (!activeSession) {
      setStatus('Account created successfully. Please log in with your email and password.', 'success');
      showPanel('login');
      return;
    }

    setStatus('Account created successfully. Redirecting to your account...', 'success');
    window.location.replace(getAuthRedirectTarget('customer-dashboard.html'));
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Could not create your account right now.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Create Account';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = authForms.login;
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const email = form.querySelector('[name="email"]')?.value.trim() || '';
  const password = form.querySelector('[name="password"]')?.value || '';

  if (!email || !password) {
    setStatus('Enter your email and password to sign in.', 'error');
    return;
  }

  button.disabled = true;
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.textContent = 'Signing In...';
  setStatus('Checking your account...', 'loading');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (isAuthorizedAdminEmail(data.user?.email)) {
      window.location.replace('admin-dashboard.html');
      return;
    }

    setStatus('Login successful. Redirecting to your account...', 'success');
    window.location.replace(getAuthRedirectTarget('customer-dashboard.html'));
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Login failed. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Login';
  }
}

authTabs.forEach((tab) => {
  tab.addEventListener('click', () => showPanel(tab.dataset.authTab));
});

authForms.signup?.addEventListener('submit', handleSignup);
authForms.login?.addEventListener('submit', handleLogin);

const requestedMode = new URLSearchParams(window.location.search).get('mode');
showPanel(requestedMode === 'signup' ? 'signup' : 'login');
handleExistingSession();
