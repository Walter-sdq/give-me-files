
export interface WebRTCConnection {
  sendFile: (file: File, onProgress: (progress: number) => void) => Promise<void>;
  onFileReceived: (callback: (file: File) => void) => void;
  onConnectionStateChange: (callback: (state: string) => void) => void;
  close: () => void;
}

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

    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(channel);
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      console.log('Data channel opened');
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
      const message = JSON.parse(data);
      if (message.type === 'file-info') {
        this.expectedFileSize = message.size;
        this.fileName = message.name;
        this.fileType = message.type;
        this.receivedChunks = [];
        this.receivedSize = 0;
      }
    } else if (data instanceof ArrayBuffer) {
      this.receivedChunks.push(data);
      this.receivedSize += data.byteLength;

      if (this.receivedSize >= this.expectedFileSize) {
        this.reconstructFile();
      }
    }
  }

  private reconstructFile() {
    const blob = new Blob(this.receivedChunks, { type: this.fileType });
    const file = new File([blob], this.fileName, { type: this.fileType });
    
    if (this.onFileReceivedCallback) {
      this.onFileReceivedCallback(file);
    }

    // Reset for next file
    this.receivedChunks = [];
    this.receivedSize = 0;
    this.expectedFileSize = 0;
  }

  async createOffer(): Promise<string> {
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true
    });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return new Promise((resolve) => {
      this.peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          resolve(JSON.stringify(this.peerConnection.localDescription));
        }
      };
    });
  }

  async createAnswer(offerString: string): Promise<string> {
    const offer = JSON.parse(offerString);
    await this.peerConnection.setRemoteDescription(offer);

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return new Promise((resolve) => {
      this.peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          resolve(JSON.stringify(this.peerConnection.localDescription));
        }
      };
    });
  }

  async acceptAnswer(answerString: string): Promise<void> {
    const answer = JSON.parse(answerString);
    await this.peerConnection.setRemoteDescription(answer);
  }

  async sendFile(file: File, onProgress: (progress: number) => void): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

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
      
      // Wait for channel to be ready if buffer is full
      while (this.dataChannel.bufferedAmount > chunkSize * 10) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.dataChannel.send(arrayBuffer);
      sentChunks++;
      onProgress((sentChunks / totalChunks) * 100);
    }
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
