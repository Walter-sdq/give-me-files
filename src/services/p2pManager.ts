
import { WebRTCService } from './webrtc';

export class P2PManager {
  private webrtc: WebRTCService | null = null;
  private connectionCode: string = '';
  private isHost: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;

  async createConnection(): Promise<string> {
    console.log('Creating P2P connection as host');
    this.webrtc = new WebRTCService();
    this.isHost = true;
    
    const offer = await this.webrtc.createOffer();
    this.connectionCode = this.generateConnectionCode();
    
    // Store offer in localStorage as simple signaling
    const signalData = {
      type: 'offer',
      data: offer,
      timestamp: Date.now()
    };
    localStorage.setItem(`p2p_signal_${this.connectionCode}`, JSON.stringify(signalData));
    
    console.log('Generated connection code:', this.connectionCode);
    console.log('Offer stored, waiting for answer...');
    
    return this.connectionCode;
  }

  async joinConnection(code: string): Promise<void> {
    console.log('Joining P2P connection with code:', code);
    this.webrtc = new WebRTCService();
    this.isHost = false;
    this.connectionCode = code;

    // Get offer from localStorage
    const signalDataStr = localStorage.getItem(`p2p_signal_${code}`);
    if (!signalDataStr) {
      throw new Error('Invalid connection code or offer not found');
    }

    const signalData = JSON.parse(signalDataStr);
    if (signalData.type !== 'offer') {
      throw new Error('Invalid signal data');
    }

    console.log('Found offer, creating answer...');
    const answer = await this.webrtc.createAnswer(signalData.data);
    
    // Store answer for host to retrieve
    const answerSignal = {
      type: 'answer',
      data: answer,
      timestamp: Date.now()
    };
    localStorage.setItem(`p2p_answer_${code}`, JSON.stringify(answerSignal));
    
    console.log('Answer created and stored');
  }

  async completeConnection(): Promise<void> {
    if (!this.webrtc || !this.isHost) {
      console.log('Not completing connection - not host or no webrtc');
      return;
    }

    console.log('Host waiting for answer...');

    // Poll for answer with timeout
    const pollForAnswer = async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (this.pollInterval) {
            clearInterval(this.pollInterval);
          }
          reject(new Error('Connection timeout - no answer received'));
        }, 60000); // 60 second timeout
        
        this.pollInterval = setInterval(() => {
          const answerStr = localStorage.getItem(`p2p_answer_${this.connectionCode}`);
          if (answerStr) {
            try {
              const answerSignal = JSON.parse(answerStr);
              if (answerSignal.type === 'answer') {
                clearTimeout(timeout);
                if (this.pollInterval) {
                  clearInterval(this.pollInterval);
                }
                console.log('Answer received, accepting...');
                this.webrtc?.acceptAnswer(answerSignal.data);
                resolve();
              }
            } catch (e) {
              console.error('Error parsing answer:', e);
            }
          }
        }, 1000); // Poll every second
      });
    };

    await pollForAnswer();
  }

  private generateConnectionCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  getWebRTCConnection(): WebRTCService | null {
    return this.webrtc;
  }

  cleanup(): void {
    console.log('Cleaning up P2P connection');
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    
    if (this.webrtc) {
      this.webrtc.close();
    }
    
    // Clean up localStorage
    if (this.connectionCode) {
      localStorage.removeItem(`p2p_signal_${this.connectionCode}`);
      localStorage.removeItem(`p2p_answer_${this.connectionCode}`);
    }
  }
}
