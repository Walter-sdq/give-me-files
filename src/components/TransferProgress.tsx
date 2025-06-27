
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Files } from 'lucide-react';

interface TransferProgressProps {
  progress: number;
  fileName: string;
  fileSize: number;
}

const TransferProgress = ({ progress, fileName, fileSize }: TransferProgressProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const transferredSize = (fileSize * progress) / 100;

  return (
    <Card className="p-6 bg-white/70 backdrop-blur-sm border-white/20 shadow-lg">
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Files className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{fileName}</h3>
            <p className="text-sm text-gray-600">
              {formatFileSize(transferredSize)} / {formatFileSize(fileSize)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-blue-600">{progress}%</span>
          </div>
        </div>

        <div className="space-y-2">
          <Progress 
            value={progress} 
            className="h-3 bg-gray-200"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Transferring...</span>
            <span>{progress === 100 ? 'Complete!' : 'In progress'}</span>
          </div>
        </div>

        {progress === 100 && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <span className="text-green-700 font-medium">
              ✅ Transfer completed successfully!
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default TransferProgress;
