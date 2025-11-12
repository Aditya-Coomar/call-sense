"use client";

import Link from "next/link";
import {
  ArrowRight,
  Phone,
  Zap,
  BarChart3,
  Brain,
  Shield,
  Mic,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-neutral-800 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Phone className="h-6 w-6" />
              <span className="text-xl font-bold">CallSense</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="#features"
                className="text-neutral-400 hover:text-white transition-colors"
              >
                Features
              </Link>
              <Link
                href="#integrations"
                className="text-neutral-400 hover:text-white transition-colors"
              >
                Integrations
              </Link>
              <Link
                href="#pricing"
                className="text-neutral-400 hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-neutral-400 hover:text-white transition-colors"
              >
                Login
              </Link>
              <Link href="/login">
                <Button className="bg-white text-black hover:bg-neutral-200">
                  Get Started
                </Button>
              </Link>
            </div>
            <div className="md:hidden">
              <Link href="/login">
                <Button
                  size="sm"
                  className="bg-white text-black hover:bg-neutral-200"
                >
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2 mb-8">
            <Bot className="h-4 w-4 text-white" />
            <span className="text-sm text-neutral-300">
              Advanced AMD Technology
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Smart Outbound
            <br />
            <span className="text-neutral-400">Call Detection</span>
            <br />
            System
          </h1>

          <p className="text-xl text-neutral-400 mb-12 max-w-2xl mx-auto">
            Detect human vs machine answers with 95%+ accuracy using multiple AI
            strategies. Connect only to humans, skip voicemails automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-white text-black hover:bg-neutral-200 w-full sm:w-auto"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-neutral-800 hover:bg-neutral-900 w-full sm:w-auto"
            >
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto">
            <div>
              <div className="text-4xl font-bold mb-2">95%+</div>
              <div className="text-neutral-400">Detection Accuracy</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">&lt;3s</div>
              <div className="text-neutral-400">Detection Latency</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">4</div>
              <div className="text-neutral-400">AMD Strategies</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="py-20 px-4 sm:px-6 lg:px-8 border-t border-neutral-900"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Multiple AMD Strategies
            </h2>
            <p className="text-xl text-neutral-400">
              Choose from 4 different detection methods for optimal accuracy
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 hover:border-neutral-700 transition-colors">
              <div className="bg-white rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-black" />
              </div>
              <h3 className="text-xl font-bold mb-3">Twilio Native AMD</h3>
              <p className="text-neutral-400">
                Built-in Twilio answering machine detection with customizable
                timeout settings.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 hover:border-neutral-700 transition-colors">
              <div className="bg-white rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-black" />
              </div>
              <h3 className="text-xl font-bold mb-3">Jambonz SIP Enhanced</h3>
              <p className="text-neutral-400">
                Advanced SIP-based detection with custom recognizers for
                improved accuracy.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 hover:border-neutral-700 transition-colors">
              <div className="bg-white rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-black" />
              </div>
              <h3 className="text-xl font-bold mb-3">Hugging Face ML</h3>
              <p className="text-neutral-400">
                Fine-tuned wav2vec model specifically trained for voicemail
                detection.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 hover:border-neutral-700 transition-colors">
              <div className="bg-white rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Bot className="h-6 w-6 text-black" />
              </div>
              <h3 className="text-xl font-bold mb-3">Gemini 2.5 Flash</h3>
              <p className="text-neutral-400">
                Real-time multimodal AI analysis for natural language
                understanding.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 hover:border-neutral-700 transition-colors">
              <div className="bg-white rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-black" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-time Analytics</h3>
              <p className="text-neutral-400">
                Live call monitoring with accuracy metrics and performance
                insights.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 hover:border-neutral-700 transition-colors">
              <div className="bg-white rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <Mic className="h-6 w-6 text-black" />
              </div>
              <h3 className="text-xl font-bold mb-3">Audio Streaming</h3>
              <p className="text-neutral-400">
                Low-latency WebSocket streams for real-time audio processing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section
        id="integrations"
        className="py-20 px-4 sm:px-6 lg:px-8 border-t border-neutral-900"
      >
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Powerful Integrations
          </h2>
          <p className="text-xl text-neutral-400 mb-16">
            Built on industry-leading telephony and AI platforms
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              "Twilio",
              "Jambonz",
              "Hugging Face",
              "Google Gemini",
              "WebRTC",
              "Postgres",
              "Docker",
              "Next.js",
            ].map((integration) => (
              <div
                key={integration}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 hover:border-neutral-700 transition-colors"
              >
                <div className="text-lg font-semibold">{integration}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-neutral-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-neutral-400 mb-12">
            Start making smarter outbound calls with advanced AMD detection
          </p>
          <Link href="/login">
            <Button
              size="lg"
              className="bg-white text-black hover:bg-neutral-200"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Phone className="h-6 w-6" />
                <span className="text-xl font-bold">CallSense</span>
              </div>
              <p className="text-neutral-400 text-sm">
                Advanced answering machine detection for smart outbound calling
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li>
                  <Link
                    href="#features"
                    className="hover:text-white transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="#integrations"
                    className="hover:text-white transition-colors"
                  >
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pricing"
                    className="hover:text-white transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-neutral-400">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-neutral-900 pt-8 text-center text-sm text-neutral-400">
            © 2025 CallSense. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
