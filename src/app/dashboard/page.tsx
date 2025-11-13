"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  PhoneCall,
  History,
  BarChart3,
  ChevronDown,
  Play,
  Square,
  Mic,
  MicOff,
  User,
  Bot,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface CallLog {
  id: string;
  targetNumber: string;
  strategy: string;
  result: string;
  confidence?: number;
  latencyMs?: number;
  startedAt: string;
  endedAt?: string;
  error?: string;
}

const AMD_STRATEGIES = [
  {
    id: "twilio",
    name: "Twilio Native AMD",
    description: "Built-in Twilio detection with timeout settings",
  },
  {
    id: "jambonz",
    name: "Jambonz SIP Enhanced",
    description: "Advanced SIP-based detection with custom recognizers",
  },
  {
    id: "huggingface",
    name: "Hugging Face ML",
    description: "Fine-tuned wav2vec model for voicemail detection",
  },
  {
    id: "gemini",
    name: "Gemini 2.5 Flash",
    description: "Real-time multimodal AI analysis",
  },
];

const TEST_NUMBERS = [
  { name: "Costco (Voicemail)", number: "1-800-774-2678" },
  { name: "Nike (Voicemail)", number: "1-800-806-6453" },
  { name: "PayPal (Voicemail)", number: "1-888-221-1161" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isPending, setIsPending] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState(AMD_STRATEGIES[0]);
  const [targetNumber, setTargetNumber] = useState("");
  const [isDialing, setIsDialing] = useState(false);
  const [callStatus, setCallStatus] = useState<string>("");
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentCall, setCurrentCall] = useState<any>(null);

  useEffect(() => {
    // Check auth status
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.push("/login");
        }
      } catch (error) {
        router.push("/login");
      } finally {
        setIsPending(false);
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchCallLogs();
    }
  }, [user]);

  const fetchCallLogs = async () => {
    try {
      const response = await fetch("/api/calls/logs");
      const data = await response.json();
      setCallLogs(data.callLogs || []);
    } catch (error) {
      console.error("Failed to fetch call logs:", error);
    }
  };

  const handleDial = async () => {
    if (!targetNumber.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsDialing(true);
    setCallStatus("Initiating call...");

    try {
      const response = await fetch("/api/calls/dial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetNumber: targetNumber.trim(),
          strategy: selectedStrategy.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentCall(data.call);
        setCallStatus("Call initiated. Waiting for answer...");
        toast.success("Call initiated successfully");

        // Poll for call status updates
        pollCallStatus(data.call.id);
      } else {
        throw new Error(data.error || "Failed to initiate call");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate call");
      setCallStatus("");
      setIsDialing(false);
    }
  };

  const pollCallStatus = (callId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/status`);
        const data = await response.json();

        if (data.status) {
          setCallStatus(data.status);

          if (data.completed) {
            clearInterval(interval);
            setIsDialing(false);
            setCurrentCall(null);
            fetchCallLogs(); // Refresh call logs

            // Show appropriate toast based on final result
            switch (data.result) {
              case "human":
                toast.success("Human detected! Call connected.");
                break;
              case "machine":
                toast("Voicemail detected. Call ended.", { icon: "ℹ️" });
                break;
              case "undecided":
                toast("Detection inconclusive.", { icon: "⚠️" });
                break;
              case "completed":
                toast("Call completed successfully.", { icon: "✅" });
                break;
              case "error":
                toast.error("Call failed with error.");
                break;
              case "no-answer":
                toast("No answer received.", { icon: "📞" });
                break;
              case "busy":
                toast("Line is busy.", { icon: "📵" });
                break;
              case "failed":
                toast.error("Call failed to connect.");
                break;
              case "canceled":
                toast("Call was canceled.", { icon: "⏹️" });
                break;
              default:
                // Only show inconclusive for truly unknown results
                if (data.result && !data.result.startsWith("unknown-")) {
                  toast(`Call result: ${data.result}`, { icon: "ℹ️" });
                } else {
                  toast("Detection inconclusive.", { icon: "⚠️" });
                }
            }
          }
        }
      } catch (error) {
        console.error("Failed to poll call status:", error);
      }
    }, 2000);

    // Clear interval after 30 seconds max
    setTimeout(() => clearInterval(interval), 30000);
  };

  const handleHangup = async () => {
    if (!currentCall) return;

    try {
      await fetch(`/api/calls/${currentCall.id}/hangup`, {
        method: "POST",
      });

      setIsDialing(false);
      setCurrentCall(null);
      setCallStatus("");
      toast("Call ended", { icon: "ℹ️" });
    } catch (error) {
      console.error("Failed to hang up call:", error);
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case "human":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "machine":
        return <Bot className="h-4 w-4 text-orange-500" />;
      case "undecided":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getResultBadge = (result: string) => {
    const colors = {
      human: "bg-green-900 text-green-300 border-green-700",
      machine: "bg-orange-900 text-orange-300 border-orange-700",
      undecided: "bg-yellow-900 text-yellow-300 border-yellow-700",
      error: "bg-red-900 text-red-300 border-red-700",
    };

    return (
      <Badge className={colors[result as keyof typeof colors] || colors.error}>
        {result.charAt(0).toUpperCase() + result.slice(1)}
      </Badge>
    );
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Phone className="h-12 w-12 mx-auto mb-4 animate-pulse" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Phone className="h-6 w-6" />
              <span className="text-xl font-bold">CallSense</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-neutral-400">
                Welcome, {user?.name || user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/api/auth/signout")}
                className="border-neutral-700"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="dialer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-neutral-900">
            <TabsTrigger value="dialer" className="flex items-center space-x-2">
              <PhoneCall className="h-4 w-4" />
              <span>Dialer</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center space-x-2"
            >
              <History className="h-4 w-4" />
              <span>Call History</span>
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex items-center space-x-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Dialer Tab */}
          <TabsContent value="dialer" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Dial Interface */}
              <Card className="bg-neutral-900 border-neutral-800 p-6">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Make a Call</h2>
                    <p className="text-neutral-400">
                      Select AMD strategy and dial a number
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="strategy">AMD Strategy</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between bg-neutral-800 border-neutral-700"
                          >
                            <span>{selectedStrategy.name}</span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full bg-neutral-800 border-neutral-700">
                          {AMD_STRATEGIES.map((strategy) => (
                            <DropdownMenuItem
                              key={strategy.id}
                              onClick={() => setSelectedStrategy(strategy)}
                              className="cursor-pointer"
                            >
                              <div>
                                <div className="font-medium">
                                  {strategy.name}
                                </div>
                                <div className="text-sm text-neutral-400">
                                  {strategy.description}
                                </div>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div>
                      <Label htmlFor="number">Phone Number</Label>
                      <Input
                        id="number"
                        type="tel"
                        value={targetNumber}
                        onChange={(e) => setTargetNumber(e.target.value)}
                        placeholder="+1234567890"
                        className="bg-neutral-800 border-neutral-700"
                        disabled={isDialing}
                      />
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        onClick={handleDial}
                        disabled={isDialing || !targetNumber.trim()}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {isDialing ? (
                          <>
                            <Square className="mr-2 h-4 w-4" />
                            Dialing...
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Dial Now
                          </>
                        )}
                      </Button>

                      {isDialing && (
                        <Button
                          onClick={handleHangup}
                          variant="destructive"
                          size="sm"
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {callStatus && (
                      <div className="p-4 bg-neutral-800 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm">{callStatus}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test Numbers */}
                  <div>
                    <h3 className="font-semibold mb-3">Test Numbers</h3>
                    <div className="space-y-2">
                      {TEST_NUMBERS.map((testNum) => (
                        <button
                          key={testNum.number}
                          onClick={() => setTargetNumber(testNum.number)}
                          className="w-full text-left p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                        >
                          <div className="font-medium">{testNum.name}</div>
                          <div className="text-sm text-neutral-400">
                            {testNum.number}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Live Call Status */}
              <Card className="bg-neutral-900 border-neutral-800 p-6">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Live Status</h2>
                    <p className="text-neutral-400">
                      Real-time call monitoring
                    </p>
                  </div>

                  {currentCall ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">
                          Target:
                        </span>
                        <span className="font-mono">
                          {currentCall.targetNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">
                          Strategy:
                        </span>
                        <Badge>{selectedStrategy.name}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">
                          Status:
                        </span>
                        <span className="text-green-400">{callStatus}</span>
                      </div>

                      <div className="pt-4 border-t border-neutral-700">
                        <div className="flex items-center justify-center space-x-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsRecording(!isRecording)}
                            className={isRecording ? "text-red-400" : ""}
                          >
                            {isRecording ? (
                              <MicOff className="h-4 w-4" />
                            ) : (
                              <Mic className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Phone className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
                      <p className="text-neutral-500">No active calls</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Call History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Call History</h2>
                  <Button
                    onClick={fetchCallLogs}
                    variant="outline"
                    size="sm"
                    className="border-neutral-700"
                  >
                    Refresh
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-700">
                        <th className="text-left py-2">Number</th>
                        <th className="text-left py-2">Strategy</th>
                        <th className="text-left py-2">Result</th>
                        <th className="text-left py-2">Confidence</th>
                        <th className="text-left py-2">Latency</th>
                        <th className="text-left py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {callLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-neutral-800 hover:bg-neutral-800/50"
                        >
                          <td className="py-3 font-mono">{log.targetNumber}</td>
                          <td className="py-3">{log.strategy}</td>
                          <td className="py-3">
                            <div className="flex items-center space-x-2">
                              {getResultIcon(log.result)}
                              {getResultBadge(log.result)}
                            </div>
                          </td>
                          <td className="py-3">
                            {log.confidence
                              ? `${Math.round(log.confidence * 100)}%`
                              : "-"}
                          </td>
                          <td className="py-3">
                            {log.latencyMs ? `${log.latencyMs}ms` : "-"}
                          </td>
                          <td className="py-3 text-sm text-neutral-400">
                            {new Date(log.startedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {callLogs.length === 0 && (
                    <div className="text-center py-8 text-neutral-500">
                      No call logs yet. Make your first call to see results
                      here.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-neutral-900 border-neutral-800 p-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <h3 className="font-semibold">Human Detected</h3>
                  </div>
                  <div className="text-3xl font-bold">
                    {callLogs.filter((log) => log.result === "human").length}
                  </div>
                </div>
              </Card>

              <Card className="bg-neutral-900 border-neutral-800 p-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-5 w-5 text-orange-500" />
                    <h3 className="font-semibold">Machine Detected</h3>
                  </div>
                  <div className="text-3xl font-bold">
                    {callLogs.filter((log) => log.result === "machine").length}
                  </div>
                </div>
              </Card>

              <Card className="bg-neutral-900 border-neutral-800 p-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Avg. Latency</h3>
                  </div>
                  <div className="text-3xl font-bold">
                    {callLogs.length > 0
                      ? Math.round(
                          callLogs
                            .filter((log) => log.latencyMs)
                            .reduce(
                              (acc, log) => acc + (log.latencyMs || 0),
                              0
                            ) / callLogs.filter((log) => log.latencyMs).length
                        )
                      : 0}
                    ms
                  </div>
                </div>
              </Card>
            </div>

            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <h2 className="text-2xl font-bold mb-4">Strategy Performance</h2>
              <div className="space-y-4">
                {AMD_STRATEGIES.map((strategy) => {
                  const strategyLogs = callLogs.filter(
                    (log) => log.strategy === strategy.id
                  );
                  const accuracy =
                    strategyLogs.length > 0
                      ? (strategyLogs.filter(
                          (log) =>
                            log.result === "human" || log.result === "machine"
                        ).length /
                          strategyLogs.length) *
                        100
                      : 0;

                  return (
                    <div
                      key={strategy.id}
                      className="flex justify-between items-center p-4 bg-neutral-800 rounded-lg"
                    >
                      <div>
                        <div className="font-semibold">{strategy.name}</div>
                        <div className="text-sm text-neutral-400">
                          {strategyLogs.length} calls
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {accuracy.toFixed(1)}% accuracy
                        </div>
                        <div className="text-sm text-neutral-400">
                          Avg:{" "}
                          {strategyLogs.filter((log) => log.latencyMs).length >
                          0
                            ? Math.round(
                                strategyLogs
                                  .filter((log) => log.latencyMs)
                                  .reduce(
                                    (acc, log) => acc + (log.latencyMs || 0),
                                    0
                                  ) /
                                  strategyLogs.filter((log) => log.latencyMs)
                                    .length
                              )
                            : 0}
                          ms
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
