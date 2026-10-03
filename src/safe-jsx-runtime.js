import * as originalRuntime from '../node_modules/react/jsx-runtime.js';

function sanitizeChild(child) {
  if (child === null || child === undefined || typeof child === 'boolean') {
    return child;
  }
  if (typeof child === 'object' && !child.$$typeof) {
    if (Array.isArray(child)) {
      return child.map(sanitizeChild);
    }
    // Firestore Timestamp or Date
    if (typeof child.toDate === 'function') {
      return child.toDate().toLocaleDateString('ar-SA');
    }
    if (child instanceof Date) {
      return child.toLocaleDateString('ar-SA');
    }
    // Extract sensible string representations
    if (child.name !== undefined) return String(child.name);
    if (child.label !== undefined) return String(child.label);
    if (child.title !== undefined) return String(child.title);
    if (child.className !== undefined) return String(child.className);
    if (child.id !== undefined) return String(child.id);
    return '';
  }
  return child;
}

function sanitizeProps(type, props) {
  if (!props) return props;
  let newProps = props;

  // 1. Sanitize HTML DOM element children
  if (typeof type === 'string' && newProps.children !== undefined) {
    if (Array.isArray(newProps.children)) {
      newProps = { ...newProps, children: newProps.children.map(sanitizeChild) };
    } else {
      newProps = { ...newProps, children: sanitizeChild(newProps.children) };
    }
  }

  // 2. Sanitize option element value if an object was passed
  if (type === 'option' && newProps.value !== undefined && typeof newProps.value === 'object' && !newProps.value.$$typeof) {
    const val = newProps.value.name || newProps.value.id || newProps.value.value || '';
    newProps = { ...newProps, value: String(val) };
  }

  return newProps;
}

export const Fragment = originalRuntime.Fragment;

export function jsx(type, props, key) {
  let safeKey = key;
  if (key !== undefined && typeof key === 'object' && !key.$$typeof) {
    safeKey = key.id || key.name || '';
  }
  return originalRuntime.jsx(type, sanitizeProps(type, props), safeKey);
}

export function jsxs(type, props, key) {
  let safeKey = key;
  if (key !== undefined && typeof key === 'object' && !key.$$typeof) {
    safeKey = key.id || key.name || '';
  }
  return originalRuntime.jsxs(type, sanitizeProps(type, props), safeKey);
}
