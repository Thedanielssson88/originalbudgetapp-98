import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { neonAuthService } from '@/services/neonAuthService';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const AuthCallbackPage = () => {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`Authentication error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        console.log('🔄 Processing OAuth callback with code:', code.substring(0, 10) + '...');

        // Handle the callback with neonAuthService
        const success = await neonAuthService.handleCallback(code);

        if (success) {
          setStatus('success');
          setMessage('Authentication successful! Redirecting...');
          
          // Redirect to settings page after a brief delay
          setTimeout(() => {
            navigate('/installningar');
          }, 2000);
        } else {
          throw new Error('Authentication failed - could not exchange code for token');
        }

      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed');
        
        // Redirect to settings page after error display
        setTimeout(() => {
          navigate('/installningar');
        }, 5000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Authenticating...</h1>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-8 w-8 text-green-600" />
              <h1 className="text-xl font-semibold text-green-900">Success!</h1>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-8 w-8 text-red-600" />
              <h1 className="text-xl font-semibold text-red-900">Authentication Failed</h1>
            </>
          )}
          
          <p className="text-center text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackPage;