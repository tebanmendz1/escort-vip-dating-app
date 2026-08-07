/**
 * Escort Platform API Client
 * Proporciona integración entre la interfaz y el Backend Node.js
 */

const API_BASE_URL = '/api';

export const EscortAPI = {
  // Token management
  getToken() {
    return localStorage.getItem('escort_token');
  },
  setToken(token) {
    localStorage.setItem('escort_token', token);
  },
  removeToken() {
    localStorage.removeItem('escort_token');
    localStorage.removeItem('escort_user');
    localStorage.removeItem('escort_admin_token');
  },
  getCurrentUser() {
    const userStr = localStorage.getItem('escort_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Headers helper
  getHeaders(isJSON = true) {
    const headers = {};
    if (isJSON) headers['Content-Type'] = 'application/json';
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  // Auth API
  async register(data) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al registrarse');
    if (json.token) {
      this.setToken(json.token);
      localStorage.setItem('escort_user', JSON.stringify(json.escort));
    }
    return json;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al iniciar sesión');
    if (json.token) {
      if (json.role === 'ADMIN') {
        localStorage.setItem('escort_admin_token', json.token);
      } else {
        this.setToken(json.token);
        if (json.escort) {
          localStorage.setItem('escort_user', JSON.stringify(json.escort));
        }
      }
    }
    return json;
  },

  async getMe() {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al obtener datos');
    localStorage.setItem('escort_user', JSON.stringify(json));
    return json;
  },

  async getWhatsappLead(id) {
    try {
      await fetch(`${API_BASE_URL}/public/escorts/${id}/whatsapp-click`, { method: 'POST' });
    } catch (e) {}
  },

  // Public Catalog API
  async getPublicEscorts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.gender) params.append('gender', filters.gender);
    if (filters.city) params.append('city', filters.city);
    if (filters.nationality) params.append('nationality', filters.nationality);
    if (filters.bodyType) params.append('bodyType', filters.bodyType);
    if (filters.service) params.append('service', filters.service);
    if (filters.minAge) params.append('minAge', filters.minAge);
    if (filters.maxAge) params.append('maxAge', filters.maxAge);
    if (filters.maxRate) params.append('maxRate', filters.maxRate);
    if (filters.isAvailable !== undefined && filters.isAvailable !== '') params.append('isAvailable', filters.isAvailable);
    if (filters.search) params.append('search', filters.search);

    const res = await fetch(`${API_BASE_URL}/public/escorts?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al cargar catálogo');
    return json;
  },

  async getEscortDetail(id) {
    const res = await fetch(`${API_BASE_URL}/public/escorts/${id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al cargar detalle');
    return json;
  },

  // Escort Profile & Media API
  async updateProfile(data) {
    const res = await fetch(`${API_BASE_URL}/escort/profile`, {
      method: 'PUT',
      headers: this.getHeaders(true),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al actualizar perfil');
    localStorage.setItem('escort_user', JSON.stringify(json));
    return json;
  },

  async toggleAvailability(isAvailable) {
    const res = await fetch(`${API_BASE_URL}/escort/availability`, {
      method: 'PATCH',
      headers: this.getHeaders(true),
      body: JSON.stringify({ isAvailable })
    });
    return await res.json();
  },

  async uploadPhoto(formData) {
    const res = await fetch(`${API_BASE_URL}/escort/photos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.getToken()}` },
      body: formData
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al subir foto');
    return json;
  },

  async deletePhoto(photoId) {
    const res = await fetch(`${API_BASE_URL}/escort/photos/${photoId}`, {
      method: 'DELETE',
      headers: this.getHeaders(true)
    });
    return await res.json();
  }
};

window.EscortAPI = EscortAPI;
