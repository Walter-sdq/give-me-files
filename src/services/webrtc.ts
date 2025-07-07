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
  private waitingForReady = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;

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
      console.log('Data channel received from peer');
      const channel = event.channel;
      this.dataChannel = channel;
      this.setupDataChannel(channel);
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    console.log('Setting up data channel:', channel.label);
    
    // Set binary type to arraybuffer for file transfers
    channel.binaryType = 'arraybuffer';
    
    channel.onopen = () => {
      console.log('Data channel opened, ready for transfers');
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
      console.log('Data channel message received:', typeof event.data, event.data instanceof ArrayBuffer ? event.data.byteLength + ' bytes' : 'metadata');
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
        console.log('Received metadata:', message);
        if (message.type === 'file-info') {
          this.expectedFileSize = message.size;
          this.fileName = message.name;
          this.fileType = message.fileType;
          this.receivedChunks = [];
          this.receivedSize = 0;
          console.log('Starting to receive file:', message.name, 'Size:', message.size, 'bytes');
          // Send ready handshake
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type: 'ready' }));
          }
        } else if (message.type === 'ready') {
          // Sender receives ready handshake
          if (this.waitingForReady && this.readyResolve) {
            this.readyResolve();
          }
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    } else if (data instanceof ArrayBuffer) {
      console.log('Received binary chunk:', data.byteLength, 'bytes');
      this.receivedChunks.push(data);
      this.receivedSize += data.byteLength;
      console.log('Received chunk:', data.byteLength, 'bytes. Total:', this.receivedSize, '/', this.expectedFileSize);

      if (this.receivedSize >= this.expectedFileSize && this.expectedFileSize > 0) {
        console.log('All chunks received, reconstructing file...');
        this.reconstructFile();
      }
    } else {
      console.log('Received unknown data type:', typeof data, data);
    }
  }

  private reconstructFile() {
    console.log('Reconstructing file from', this.receivedChunks.length, 'chunks, total size:', this.receivedSize);
    
    // Create blob from all chunks
    const blob = new Blob(this.receivedChunks, { type: this.fileType || 'application/octet-stream' });
    const file = new File([blob], this.fileName, { 
      type: this.fileType || 'application/octet-stream',
      lastModified: Date.now()
    });
    
    console.log('File reconstructed successfully:', file.name, file.size, 'bytes, type:', file.type);
    
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
    console.log('Creating data channel for offer');
    this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
      ordered: true,
      maxRetransmits: 3
    });
    
    // Set binary type immediately
    this.dataChannel.binaryType = 'arraybuffer';
    this.setupDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    return new Promise((resolve) => {
      const checkState = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          console.log('ICE gathering complete, offer ready');
          resolve(JSON.stringify(this.peerConnection.localDescription));
        } else {
          setTimeout(checkState, 100);
        }
      };
      
      this.peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          console.log('No more ICE candidates, offer ready');
          resolve(JSON.stringify(this.peerConnection.localDescription));
        }
      };
      
      checkState();
    });
  }

  async createAnswer(offerString: string): Promise<string> {
    try {
      const offer = JSON.parse(offerString);
      console.log('Setting remote description with offer');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Wait for ICE gathering to complete
      return new Promise((resolve) => {
        const checkState = () => {
          if (this.peerConnection.iceGatheringState === 'complete') {
            console.log('ICE gathering complete, answer ready');
            resolve(JSON.stringify(this.peerConnection.localDescription));
          } else {
            setTimeout(checkState, 100);
          }
        };
        
        this.peerConnection.onicecandidate = (event) => {
          if (!event.candidate) {
            console.log('No more ICE candidates, answer ready');
            resolve(JSON.stringify(this.peerConnection.localDescription));
          }
        };
        
        checkState();
      });
    } catch (error) {
      console.error('Error creating answer:', error);
      throw error;
    }
  }

  async acceptAnswer(answerString: string): Promise<void> {
    try {
      const answer = JSON.parse(answerString);
      console.log('Setting remote description with answer');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error accepting answer:', error);
      throw error;
    }
  }

  async sendFile(file: File, onProgress: (progress: number) => void): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready for transfer');
    }

    console.log('Starting file transfer:', file.name, file.size, 'bytes, type:', file.type);

    // Send file info first
    const fileInfo = {
      type: 'file-info',
      name: file.name,
      size: file.size,
      fileType: file.type
    };
    
    console.log('Sending file metadata:', fileInfo);
    this.dataChannel.send(JSON.stringify(fileInfo));

    // Wait for receiver to send 'ready' handshake
    this.waitingForReady = true;
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = () => {
        this.waitingForReady = false;
        this.readyPromise = null;
        this.readyResolve = null;
        resolve();
      };
    });
    console.log('Waiting for receiver ready handshake...');
    await this.readyPromise;
    console.log('Receiver is ready, starting file transfer.');

    // Convert file to ArrayBuffer first
    const fileBuffer = await file.arrayBuffer();
    console.log('File converted to ArrayBuffer:', fileBuffer.byteLength, 'bytes');

    // Send file in chunks
    const chunkSize = 16384; // 16KB chunks
    const totalChunks = Math.ceil(fileBuffer.byteLength / chunkSize);
    let sentChunks = 0;

    console.log('Will send', totalChunks, 'chunks of', chunkSize, 'bytes each');

    for (let start = 0; start < fileBuffer.byteLength; start += chunkSize) {
      const end = Math.min(start + chunkSize, fileBuffer.byteLength);
      const chunk = fileBuffer.slice(start, end);
      
      // Wait for channel buffer to clear if needed
      while (this.dataChannel.bufferedAmount > chunkSize * 10) {
        console.log('Waiting for buffer to clear, current:', this.dataChannel.bufferedAmount);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('Sending chunk', sentChunks + 1, '/', totalChunks, '- Size:', chunk.byteLength, 'bytes, buffered:', this.dataChannel.bufferedAmount);
      
      try {
        this.dataChannel.send(chunk);
        sentChunks++;
        
        const progress = (sentChunks / totalChunks) * 100;
        onProgress(progress);
        
        // Small delay between chunks to prevent overwhelming
        if (sentChunks < totalChunks) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (error) {
        console.error('Error sending chunk:', error);
        throw new Error(`Failed to send chunk ${sentChunks + 1}: ${error}`);
      }
    }

    console.log('File transfer completed - sent', sentChunks, 'chunks, total bytes:', fileBuffer.byteLength);
  }

  onFileReceived(callback: (file: File) => void): void {
    this.onFileReceivedCallback = async (file: File) => {
      // Try File System Access API if available
      if ('showDirectoryPicker' in window) {
        try {
          // Prompt user to pick a directory
          // @ts-ignore
          const dirHandle = await window.showDirectoryPicker();
          const fileHandle = await dirHandle.getFileHandle(file.name, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(file);
          await writable.close();
          alert(`File saved to: ${file.name}`);
        } catch (e) {
          console.error('Failed to save file to selected directory:', e);
          // Fallback to callback (download in browser)
          callback(file);
        }
      } else {
        // Fallback for browsers without File System Access API
        callback(file);
      }
    };
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
