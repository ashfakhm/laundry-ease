import toast, { Toaster } from 'react-hot-toast';

// Custom toast styles matching the app's design system
const toastStyles = {
  success: {
    style: {
      background: 'hsl(var(--card))',
      color: 'hsl(var(--foreground))',
      border: '1px solid hsl(var(--border))',
      borderLeft: '4px solid #10b981',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
    },
    iconTheme: {
      primary: '#10b981',
      secondary: '#fff',
    },
  },
  error: {
    style: {
      background: 'hsl(var(--card))',
      color: 'hsl(var(--foreground))',
      border: '1px solid hsl(var(--border))',
      borderLeft: '4px solid #ef4444',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
    },
    iconTheme: {
      primary: '#ef4444',
      secondary: '#fff',
    },
  },
  loading: {
    style: {
      background: 'hsl(var(--card))',
      color: 'hsl(var(--foreground))',
      border: '1px solid hsl(var(--border))',
      borderLeft: '4px solid hsl(var(--primary))',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
    },
  },
};

// Toast utility functions
export const showToast = {
  success: (message: string) => {
    toast.success(message, toastStyles.success);
  },
  error: (message: string) => {
    toast.error(message, toastStyles.error);
  },
  loading: (message: string) => {
    return toast.loading(message, toastStyles.loading);
  },
  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        success: toastStyles.success,
        error: toastStyles.error,
        loading: toastStyles.loading,
      }
    );
  },
};

// Toaster component to be added to root layout
export { Toaster };
