import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlatform } from "@/hooks/usePlatform";

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { isIOS } = usePlatform();

  // Redirect authenticated users to home
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Signup form state
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(loginData.email, loginData.password);

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Login Failed",
            description:
              "Invalid email or password. Please check your credentials and try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate("/");
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (signupData.password.length < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await signUp(
        signupData.email,
        signupData.password,
        signupData.name
      );

      if (error) {
        if (error.message.includes("User already registered")) {
          toast({
            title: "Account Exists",
            description:
              "An account with this email already exists. Please try logging in instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Registration Failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Account Created!",
          description:
            "Please check your email to verify your account before logging in.",
        });
        // Reset form and switch to login tab
        setSignupData({
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // iOS-only login form (no signup)
  const renderIOSLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="login-email" className="text-foreground">
          Email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="login-email"
            type="email"
            placeholder="Enter your email"
            value={loginData.email}
            onChange={(e) =>
              setLoginData({ ...loginData, email: e.target.value })
            }
            className="pl-10 bg-background/50 border-border focus:border-primary"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password" className="text-foreground">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={loginData.password}
            onChange={(e) =>
              setLoginData({
                ...loginData,
                password: e.target.value,
              })
            }
            className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-smooth"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full gradient-accent text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-bounce"
        disabled={loading}
      >
        {loading ? "Logging In..." : "Log In"}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header with back button */}
        <div className="flex items-center mb-8">
          <Link
            to="/"
            className="flex items-center text-muted-foreground hover:text-primary transition-smooth"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              <img src="/signature-tv-logo.png" alt="" />{" "}
            </span>
          </div>
          <p className="text-muted-foreground">Premium movie rental platform</p>
        </div>

        <Card className="gradient-card border-border/50 shadow-premium">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              {isIOS ? "Welcome to Signature TV" : "Welcome"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isIOS 
                ? "Log in to access your content."
                : "Sign in to your account or create a new one"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isIOS ? (
              // iOS: Login-only form (no tabs, no signup)
              renderIOSLoginForm()
            ) : (
              // Web/Android: Full tabs with login and signup
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary">
                  <TabsTrigger
                    value="login"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-foreground">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="Enter your email"
                          value={loginData.email}
                          onChange={(e) =>
                            setLoginData({ ...loginData, email: e.target.value })
                          }
                          className="pl-10 bg-background/50 border-border focus:border-primary"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-foreground">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={loginData.password}
                          onChange={(e) =>
                            setLoginData({
                              ...loginData,
                              password: e.target.value,
                            })
                          }
                          className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-smooth"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full gradient-accent text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-bounce"
                      disabled={loading}
                    >
                      {loading ? "Signing In..." : "Sign In"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-foreground">
                        Full Name
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Enter your full name"
                          value={signupData.name}
                          onChange={(e) =>
                            setSignupData({ ...signupData, name: e.target.value })
                          }
                          className="pl-10 bg-background/50 border-border focus:border-primary"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-foreground">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="Enter your email"
                          value={signupData.email}
                          onChange={(e) =>
                            setSignupData({
                              ...signupData,
                              email: e.target.value,
                            })
                          }
                          className="pl-10 bg-background/50 border-border focus:border-primary"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="signup-password"
                        className="text-foreground"
                      >
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          value={signupData.password}
                          onChange={(e) =>
                            setSignupData({
                              ...signupData,
                              password: e.target.value,
                            })
                          }
                          className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-smooth"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="signup-confirm-password"
                        className="text-foreground"
                      >
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          value={signupData.confirmPassword}
                          onChange={(e) =>
                            setSignupData({
                              ...signupData,
                              confirmPassword: e.target.value,
                            })
                          }
                          className="pl-10 bg-background/50 border-border focus:border-primary"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full gradient-accent text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-bounce"
                      disabled={loading}
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Footer text - only for Web/Android */}
        {!isIOS && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        )}
      </div>
    </div>
  );
};

export default Auth;
