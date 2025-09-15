import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { setToken } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { StickyNote } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/auth/login', formData);
      const data = await response.json();
      
      setToken(data.token);
      // clear react-query cache so data is refetched under the new tenant context
      try { queryClient.invalidateQueries(); } catch (e) { /* ignore */ }
      toast({
        title: "Success",
        description: "Login successful!",
      });
      setLocation('/notes');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <div className="w-full max-w-md">
        <Card className="bg-card rounded-lg shadow-xl border border-border p-8">
          <CardContent className="pt-0">
            {/* Logo and Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <StickyNote className="text-2xl text-primary-foreground" size={24} />
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome to NotesApp</h1>
              <p className="text-muted-foreground">Multi-tenant notes management platform</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6" data-testid="form-login">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full"
                  required
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full"
                  required
                  data-testid="input-password"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            {/* Demo Accounts */}
            <div className="mt-8 p-4 bg-muted rounded-md">
              <h3 className="text-sm font-medium text-foreground mb-3">Demo Accounts:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="space-y-1">
                  <div className="text-muted-foreground">ACME Corp:</div>
                  <div>admin@acme.test</div>
                  <div>user@acme.test</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Globex Inc:</div>
                  <div>admin@globex.test</div>
                  <div>user@globex.test</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Password: "password"</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
