import React, { useState } from "react";
import { X, Send } from "lucide-react";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";

export default function ContactForm({ isOpen, onClose }) {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      setError("All fields are required");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${BACKEND_URL}/api/public/contact`, {
        name: formData.name,
        email: formData.email,
        message: formData.message,
      });
      setSubmitted(true);
      setFormData({ name: "", email: "", message: "" });
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send message. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-heading-dark">Contact Us</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="mb-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <Send className="text-green-600" size={24} />
                </div>
              </div>
              <p className="text-heading-dark font-semibold">Message Sent!</p>
              <p className="text-sm text-gray-600 mt-2">Thanks for reaching out. We'll get back to you soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-100 text-red-700 text-sm rounded-md">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-heading-dark mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-heading-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-heading-dark mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-heading-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-heading-dark mb-1">Message</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us your feedback or question..."
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-heading-dark placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {submitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
