
export class WebRTCService {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private onFileReceivedCallback: ((file: File) => void) | null = null;
  private onConnectionStateCallback: ((state: string) => void) | null = null;
  private receivedChunks: ArrayBuffer[] = [];
  private expectedFileSize = 0;
  private receivedSize = 0;
  private fileName = '';
  private fileType = '';

  constructor() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.setupPeerConnection();
  }

  private setupPeerConnection() {
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback(this.peerConnection.connectionState);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
    };

    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.dataChannel = channel;
      this.setupDataChannel(channel);
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      console.log('Data channel opened');
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback('connected');
      }
    };

    channel.onclose = () => {
      console.log('Data channel closed');
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback('disconnected');
      }
    };

    channel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  private handleDataChannelMessage(data: any) {
    if (typeof data === 'string') {
      try {
        const message = JSON.parse(data);
        if (message.type === 'file-info') {
          this.expectedFileSize = message.size;
          this.fileName = message.name;
          this.fileType = message.fileType;
          this.receivedChunks = [];
          this.receivedSize = 0;
          console.log('Receiving file:', message.name, 'Size:', message.size);
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    } else if (data instanceof ArrayBuffer) {
      this.receivedChunks.push(data);
      this.receivedSize += data.byteLength;
      console.log('Received chunk:', data.byteLength, 'bytes. Total:', this.receivedSize, '/', this.expectedFileSize);

      if (this.receivedSize >= this.expectedFileSize && this.expectedFileSize > 0) {
        this.reconstructFile();
      }
    }
  }

  private reconstructFile() {
    console.log('Reconstructing file from', this.receivedChunks.length, 'chunks');
    const blob = new Blob(this.receivedChunks, { type: this.fileType });
    const file = new File([blob], this.fileName, { type: this.fileType });
    
    if (this.onFileReceivedCallback) {
      this.onFileReceivedCallback(file);
    }

    // Reset for next file
    this.receivedChunks = [];
    this.receivedSize = 0;
    this.expectedFileSize = 0;
    this.fileName = '';
    this.fileType = '';
  }

  async createOffer(): Promise<string> {
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true
    });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    return new Promise((resolve) => {
      const checkState = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          resolve(JSON.stringify(this.peerConnection.localDescription));
        } else {
          setTimeout(checkState, 100);
        }
      };
      
      this.peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          resolve(JSON.stringify(this.peerConnection.localDescription));
        }
      };
      
      // Fallback timeout
      setTimeout(() => {
        resolve(JSON.stringify(this.peerConnection.localDescription));
      }, 5000);
    });
  }

  async createAnswer(offerString: string): Promise<string> {
    try {
      const offer = JSON.parse(offerString);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Wait for ICE gathering to complete
      return new Promise((resolve) => {
        const checkState = () => {
          if (this.peerConnection.iceGatheringState === 'complete') {
            resolve(JSON.stringify(this.peerConnection.localDescription));
          } else {
            setTimeout(checkState, 100);
          }
        };
        
        this.peerConnection.onicecandidate = (event) => {
          if (!event.candidate) {
            resolve(JSON.stringify(this.peerConnection.localDescription));
          }
        };
        
        // Fallback timeout
        setTimeout(() => {
          resolve(JSON.stringify(this.peerConnection.localDescription));
        }, 5000);
      });
    } catch (error) {
      console.error('Error creating answer:', error);
      throw error;
    }
  }

  async acceptAnswer(answerString: string): Promise<void> {
    try {
      const answer = JSON.parse(answerString);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error accepting answer:', error);
      throw error;
    }
  }

  async sendFile(file: File, onProgress: (progress: number) => void): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    console.log('Starting file transfer:', file.name, file.size, 'bytes');

    // Send file info first
    const fileInfo = {
      type: 'file-info',
      name: file.name,
      size: file.size,
      fileType: file.type
    };
    this.dataChannel.send(JSON.stringify(fileInfo));

    // Send file in chunks
    const chunkSize = 16384; // 16KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    let sentChunks = 0;

    for (let start = 0; start < file.size; start += chunkSize) {
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();
      
      // Wait for channel buffer to clear if needed
      while (this.dataChannel.bufferedAmount > chunkSize * 64) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.dataChannel.send(arrayBuffer);
      sentChunks++;
      const progress = (sentChunks / totalChunks) * 100;
      onProgress(progress);
      console.log('Sent chunk', sentChunks, '/', totalChunks, '- Progress:', progress.toFixed(1) + '%');
    }

    console.log('File transfer completed');
  }

  onFileReceived(callback: (file: File) => void): void {
    this.onFileReceivedCallback = callback;
  }

  onConnectionStateChange(callback: (state: string) => void): void {
    this.onConnectionStateCallback = callback;
  }

  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    this.peerConnection.close();
  }
}
