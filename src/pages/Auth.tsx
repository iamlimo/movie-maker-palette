import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowLeft,
  Phone,
  MailCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePlatform } from "@/hooks/usePlatform";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { isIOS, isNative } = usePlatform();
  const [searchParams, setSearchParams] = useSearchParams();

  // Native apps use a single-view, mode-driven flow (no tabs) for a
  // more app-like experience.
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const goToMode = (next: "login" | "signup") => {
    setSearchParams(next === "signup" ? { mode: "signup" } : {}, {
      replace: true,
    });
  };

  // Redirect authenticated users to home
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  const { toast } = useToast();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(
    null,
  );

  // Login form state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Signup form state
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
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
        signupData.name,
        signupData.phoneNumber,
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
        setSignupSuccessEmail(signupData.email);
        // Reset form and switch to login tab
        setSignupData({
          name: "",
          email: "",
          phoneNumber: "",
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

      <div className="flex items-center justify-between mt-4">
        <button
          type="button"
          onClick={() => setShowForgotPassword(true)}
          className="text-sm text-primary hover:text-primary/80 transition-smooth font-medium"
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        className="w-full gradient-accent text-primary-foreground font-semibold shadow-glow hover:scale-105 transition-bounce"
        disabled={loading}
      >
        {loading ? "Logging In..." : "Log In"}
      </Button>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground">
            New here?
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => goToMode("signup")}
        className="w-full border-primary/40 text-primary hover:bg-primary/10 font-semibold"
      >
        Create account
      </Button>
    </form>
  );

  // Native signup form (single view, with back + log in affordances)
  const renderNativeSignupForm = () => (
    <form onSubmit={handleSignup} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="native-signup-name" className="text-foreground">
          Full Name
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="native-signup-name"
            type="text"
            autoComplete="name"
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
        <Label htmlFor="native-signup-email" className="text-foreground">
          Email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="native-signup-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="Enter your email"
            value={signupData.email}
            onChange={(e) =>
              setSignupData({ ...signupData, email: e.target.value })
            }
            className="pl-10 bg-background/50 border-border focus:border-primary"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="native-signup-phone" className="text-foreground">
          Phone Number{" "}
          <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="native-signup-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. +234 800 000 0000"
            value={signupData.phoneNumber}
            onChange={(e) =>
              setSignupData({ ...signupData, phoneNumber: e.target.value })
            }
            className="pl-10 bg-background/50 border-border focus:border-primary"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="native-signup-password" className="text-foreground">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="native-signup-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a password"
            value={signupData.password}
            onChange={(e) =>
              setSignupData({ ...signupData, password: e.target.value })
            }
            className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
            required
            minLength={6}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
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
        <p className="text-xs text-muted-foreground">
          Use at least 6 characters.
        </p>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="native-signup-confirm-password"
          className="text-foreground"
        >
          Confirm Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="native-signup-confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
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

      <Button
        type="button"
        variant="ghost"
        onClick={() => goToMode("login")}
        className="w-full text-muted-foreground hover:text-foreground"
      >
        Already have an account?{" "}
        <span className="ml-1 font-semibold text-primary">Log In</span>
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        By creating an account you agree to our Terms of Service and Privacy
        Policy.
      </p>
    </form>
  );

  const renderSignupSuccess = () => (
    <div className="space-y-6 text-center animate-in fade-in duration-300">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
        <MailCheck className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">
            {signupSuccessEmail}
          </span>
          . Confirm your email, then log in to start watching.
        </p>
      </div>
      <Button
        className="w-full gradient-accent text-primary-foreground font-semibold shadow-glow"
        onClick={() => {
          setSignupSuccessEmail(null);
          goToMode("login");
        }}
      >
        Go to Log In
      </Button>
    </div>
  );

  return (
    <div
      className="min-h-screen gradient-hero flex items-center justify-center p-4"
      style={
        isNative
          ? {
              paddingTop: "calc(env(safe-area-inset-top) + 24px)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
            }
          : undefined
      }
    >
      <div className="w-full max-w-md">
        {/* Header with back button */}
        <div className="flex items-center mb-4 min-h-10">
          {isNative && (
            <button
              type="button"
              aria-label="Go back"
              onClick={() => {
                if (signupSuccessEmail) {
                  setSignupSuccessEmail(null);
                  goToMode("login");
                } else if (mode === "signup") {
                  goToMode("login");
                } else {
                  navigate("/");
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-background/40 text-muted-foreground backdrop-blur-sm transition-smooth hover:text-primary active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              <img src="/signature-tv-logo.png" alt="" />{" "}
            </span>
          </div>
          <p className="text-muted-foreground">
            Premium blockbusters and TV shows!
          </p>
        </div>

        <Card className="gradient-card border-border/50 shadow-premium">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">
              {isNative
                ? signupSuccessEmail
                  ? "Almost there"
                  : mode === "signup"
                    ? "Create your account"
                    : "Welcome to Signature TV"
                : "Welcome"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isNative
                ? signupSuccessEmail
                  ? "One quick step to finish setting up."
                  : mode === "signup"
                    ? "It takes less than a minute to get started."
                    : "Log in to access your content."
                : "Sign in to your account or create a new one"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isNative ? (
              // Native (iOS/Android): single-view, mode-driven flow
              <div key={signupSuccessEmail ? "success" : mode} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                {signupSuccessEmail
                  ? renderSignupSuccess()
                  : mode === "signup"
                    ? renderNativeSignupForm()
                    : renderIOSLoginForm()}
              </div>
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
                            setLoginData({
                              ...loginData,
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
                        htmlFor="login-password"
                        className="text-foreground"
                      >
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

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-primary hover:text-primary/80 transition-smooth font-medium"
                      >
                        Forgot password?
                      </button>
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
                            setSignupData({
                              ...signupData,
                              name: e.target.value,
                            })
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
                      <Label htmlFor="signup-phone" className="text-foreground">
                        Phone Number <span className="text-muted-foreground text-xs">(optional)</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="e.g. +234 800 000 0000"
                          value={signupData.phoneNumber}
                          onChange={(e) =>
                            setSignupData({
                              ...signupData,
                              phoneNumber: e.target.value,
                            })
                          }
                          className="pl-10 bg-background/50 border-border focus:border-primary"
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

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
};

export default Auth;
