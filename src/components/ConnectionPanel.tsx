
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Network, Share } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConnectionPanelProps {
  mode: 'send' | 'receive';
  connectionCode: string;
  isConnected: boolean;
  onConnect: () => void;
}

const ConnectionPanel = ({ mode, connectionCode, isConnected, onConnect }: ConnectionPanelProps) => {
  const [inputCode, setInputCode] = useState('');
  const { toast } = useToast();

  const handleConnect = () => {
    if (mode === 'receive' && inputCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter a 6-character connection code",
        variant: "destructive",
      });
      return;
    }
    
    onConnect();
    toast({
      title: "Connected!",
      description: "Successfully connected to peer device",
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(connectionCode);
    toast({
      title: "Copied!",
      description: "Connection code copied to clipboard",
    });
  };

  return (
    <Card className="p-6 bg-white/70 backdrop-blur-sm border-white/20 shadow-lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <Network className="h-5 w-5 mr-2" />
            Connection
          </h3>
          <Badge 
            variant={isConnected ? "default" : "secondary"}
            className={`${isConnected ? 'bg-green-500' : 'bg-gray-400'} text-white`}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        {mode === 'send' && connectionCode && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Share this code with the receiver:</p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-4 text-center">
                <span className="text-2xl font-mono font-bold text-blue-700">
                  {connectionCode}
                </span>
              </div>
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="icon"
                className="hover:bg-blue-50"
              >
                <Share className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {mode === 'receive' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Enter the connection code:</p>
            <Input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="text-center text-lg font-mono tracking-wider"
            />
          </div>
        )}

        {!isConnected && (
          <Button
            onClick={handleConnect}
            disabled={mode === 'receive' && inputCode.length !== 6}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg transition-all duration-300"
          >
            Connect
          </Button>
        )}

        {isConnected && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3"></div>
              <span className="text-green-700 font-medium">
                Connected to peer device
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ConnectionPanel;
