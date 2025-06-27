import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, Download, Share, Network } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FileDropZone from '@/components/FileDropZone';
import ConnectionPanel from '@/components/ConnectionPanel';
import TransferProgress from '@/components/TransferProgress';
import { P2PManager } from '@/services/p2pManager';
import { WebRTCService } from '@/services/webrtc';

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionCode, setConnectionCode] = useState('');
  const [transferProgress, setTransferProgress] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [mode, setMode] = useState<'send' | 'receive'>('send');
  const [receivedFile, setReceivedFile] = useState<File | null>(null);
  const { toast } = useToast();
  
  const p2pManagerRef = useRef<P2PManager | null>(null);
  const webrtcRef = useRef<WebRTCService | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (p2pManagerRef.current) {
        p2pManagerRef.current.cleanup();
      }
    };
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    toast({
      title: "File selected",
      description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
    });
  }, [toast]);

  const generateConnectionCode = async () => {
    try {
      p2pManagerRef.current = new P2PManager();
      const code = await p2pManagerRef.current.createConnection();
      setConnectionCode(code);
      
      // Setup WebRTC callbacks
      const webrtc = p2pManagerRef.current.getWebRTCConnection();
      if (webrtc) {
        webrtcRef.current = webrtc;
        webrtc.onConnectionStateChange((state) => {
          console.log('Connection state changed:', state);
          setIsConnected(state === 'connected');
        });
        
        webrtc.onFileReceived((file) => {
          setReceivedFile(file);
          toast({
            title: "File received!",
            description: `Received ${file.name}`,
          });
        });
      }

      toast({
        title: "Connection code generated",
        description: `Share this code: ${code}`,
      });

      // Complete connection (wait for peer)
      await p2pManagerRef.current.completeConnection();
    } catch (error) {
      console.error('Error generating connection:', error);
      toast({
        title: "Connection failed",
        description: "Failed to create connection",
        variant: "destructive",
      });
    }
  };

  const joinConnection = async (code: string) => {
    try {
      p2pManagerRef.current = new P2PManager();
      await p2pManagerRef.current.joinConnection(code);
      
      // Setup WebRTC callbacks
      const webrtc = p2pManagerRef.current.getWebRTCConnection();
      if (webrtc) {
        webrtcRef.current = webrtc;
        webrtc.onConnectionStateChange((state) => {
          console.log('Connection state changed:', state);
          setIsConnected(state === 'connected');
        });
        
        webrtc.onFileReceived((file) => {
          setReceivedFile(file);
          toast({
            title: "File received!",
            description: `Received ${file.name}`,
          });
        });
      }

      toast({
        title: "Connected!",
        description: "Successfully connected to peer device",
      });
    } catch (error) {
      console.error('Error joining connection:', error);
      toast({
        title: "Connection failed",
        description: "Failed to connect to peer",
        variant: "destructive",
      });
    }
  };

  const startTransfer = async () => {
    if (!selectedFile || !webrtcRef.current) {
      toast({
        title: "Error",
        description: "No file selected or connection not ready",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsTransferring(true);
      setTransferProgress(0);

      await webrtcRef.current.sendFile(selectedFile, (progress) => {
        setTransferProgress(progress);
      });

      setIsTransferring(false);
      toast({
        title: "Transfer complete!",
        description: "File has been successfully sent",
      });
    } catch (error) {
      console.error('Transfer error:', error);
      setIsTransferring(false);
      toast({
        title: "Transfer failed",
        description: "Failed to send file",
        variant: "destructive",
      });
    }
  };

  const downloadReceivedFile = () => {
    if (!receivedFile) return;

    const url = URL.createObjectURL(receivedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = receivedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "File downloaded",
      description: `${receivedFile.name} has been downloaded`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <Network className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            P2P File Share
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Share large files directly between devices without servers. Fast, secure, and completely offline.
          </p>
        </div>

        {/* Mode Selection */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-white/20">
            <div className="flex space-x-2">
              <Button
                onClick={() => setMode('send')}
                variant={mode === 'send' ? 'default' : 'ghost'}
                className={`px-6 py-3 rounded-xl transition-all duration-300 ${
                  mode === 'send' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'hover:bg-white/50'
                }`}
              >
                <Upload className="h-4 w-4 mr-2" />
                Send File
              </Button>
              <Button
                onClick={() => setMode('receive')}
                variant={mode === 'receive' ? 'default' : 'ghost'}
                className={`px-6 py-3 rounded-xl transition-all duration-300 ${
                  mode === 'receive' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'hover:bg-white/50'
                }`}
              >
                <Download className="h-4 w-4 mr-2" />
                Receive File
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* File Upload Section */}
            {mode === 'send' && (
              <div className="space-y-6">
                <FileDropZone onFileSelect={handleFileSelect} selectedFile={selectedFile} />
                
                {selectedFile && (
                  <Card className="p-6 bg-white/70 backdrop-blur-sm border-white/20 shadow-lg">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Ready to Share</h3>
                        <Button
                          onClick={generateConnectionCode}
                          disabled={!!connectionCode}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg transition-all duration-300"
                        >
                          <Share className="h-4 w-4 mr-2" />
                          {connectionCode ? 'Code Generated' : 'Generate Code'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Connection Panel */}
            <div className="space-y-6">
              <ConnectionPanel
                mode={mode}
                connectionCode={connectionCode}
                isConnected={isConnected}
                onConnect={joinConnection}
              />

              {/* Transfer Progress */}
              {isTransferring && selectedFile && (
                <TransferProgress
                  progress={transferProgress}
                  fileName={selectedFile.name}
                  fileSize={selectedFile.size}
                />
              )}

              {/* Start Transfer Button */}
              {isConnected && selectedFile && !isTransferring && mode === 'send' && (
                <Card className="p-6 bg-white/70 backdrop-blur-sm border-white/20 shadow-lg">
                  <Button
                    onClick={startTransfer}
                    className="w-full py-4 text-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg transition-all duration-300"
                  >
                    Start Transfer
                  </Button>
                </Card>
              )}

              {/* Received File */}
              {receivedFile && (
                <Card className="p-6 bg-white/70 backdrop-blur-sm border-white/20 shadow-lg">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-green-700">File Received!</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{receivedFile.name}</p>
                        <p className="text-sm text-gray-600">
                          {(receivedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        onClick={downloadReceivedFile}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg transition-all duration-300"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Network className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Direct Connection</h3>
            <p className="text-gray-600">Files are shared directly between devices using WebRTC technology</p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Large Files</h3>
            <p className="text-gray-600">No size limits - share files of any size efficiently</p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Download className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Offline Ready</h3>
            <p className="text-gray-600">Works completely offline once connected to another device</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
