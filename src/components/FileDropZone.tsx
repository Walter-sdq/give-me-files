
import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Upload, Files } from 'lucide-react';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

const FileDropZone = ({ onFileSelect, selectedFile }: FileDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card 
      className={`p-8 bg-white/70 backdrop-blur-sm border-2 border-dashed transition-all duration-300 cursor-pointer hover:shadow-lg ${
        isDragOver 
          ? 'border-blue-500 bg-blue-50/50 scale-105' 
          : selectedFile 
            ? 'border-green-500 bg-green-50/50' 
            : 'border-gray-300 hover:border-blue-400'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        className="hidden"
        onChange={handleFileInput}
      />
      
      <div className="text-center space-y-4">
        {selectedFile ? (
          <>
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <Files className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-700 mb-2">File Selected</h3>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-gray-600">{formatFileSize(selectedFile.size)}</p>
            </div>
          </>
        ) : (
          <>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-all duration-300 ${
              isDragOver 
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 scale-110' 
                : 'bg-gradient-to-r from-gray-400 to-gray-500'
            }`}>
              <Upload className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {isDragOver ? 'Drop your file here' : 'Choose or drag a file'}
              </h3>
              <p className="text-gray-600">
                Select any file to share with another device
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default FileDropZone;
