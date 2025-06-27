
import { WebRTCService } from './webrtc';

export class P2PManager {
  private webrtc: WebRTCService | null = null;
  private connectionCode: string = '';
  private isHost: boolean = false;

  async createConnection(): Promise<string> {
    this.webrtc = new WebRTCService();
    this.isHost = true;
    
    const offer = await this.webrtc.createOffer();
    this.connectionCode = this.generateConnectionCode();
    
    // Store offer in localStorage with connection code
    localStorage.setItem(`p2p_offer_${this.connectionCode}`, offer);
    
    return this.connectionCode;
  }

  async joinConnection(code: string): Promise<void> {
    this.webrtc = new WebRTCService();
    this.isHost = false;
    this.connectionCode = code;

    // Get offer from localStorage
    const offer = localStorage.getItem(`p2p_offer_${code}`);
    if (!offer) {
      throw new Error('Invalid connection code');
    }

    const answer = await this.webrtc.createAnswer(offer);
    
    // Store answer for host to retrieve
    localStorage.setItem(`p2p_answer_${code}`, answer);
  }

  async completeConnection(): Promise<void> {
    if (!this.webrtc || !this.isHost) return;

    // Poll for answer
    const pollForAnswer = async (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 30000);
        
        const poll = () => {
          const answer = localStorage.getItem(`p2p_answer_${this.connectionCode}`);
          if (answer) {
            clearTimeout(timeout);
            this.webrtc?.acceptAnswer(answer);
            resolve();
          } else {
            setTimeout(poll, 1000);
          }
        };
        poll();
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
    if (this.webrtc) {
      this.webrtc.close();
    }
    
    // Clean up localStorage
    if (this.connectionCode) {
      localStorage.removeItem(`p2p_offer_${this.connectionCode}`);
      localStorage.removeItem(`p2p_answer_${this.connectionCode}`);
    }
  }
}
