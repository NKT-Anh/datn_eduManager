import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, X, Minimize2, Maximize2 } from 'lucide-react';
import { aiChatApi, ChatMessage } from '@/services/aiChatApi';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
// Simple markdown-like formatting helper
const formatText = (text: string): React.ReactNode => {
  // Convert **text** to bold and handle newlines
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const formattedParts = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${lineIdx}-${partIdx}`}>{part.slice(2, -2)}</strong>;
      }
      return <span key={`${lineIdx}-${partIdx}`}>{part}</span>;
    });
    return (
      <React.Fragment key={lineIdx}>
        {formattedParts}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  data?: any;
  action?: string;
}

export function AIChatbox() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Xin chào! Tôi là trợ lý AI của hệ thống. Tôi có thể giúp bạn:\n\n👨‍🎓 **Học sinh:** Tìm email, mã số, lịch thi, phòng học, xem điểm\n👨‍🏫 **Giáo viên:** Xem lớp dạy, thời khóa biểu, hướng dẫn nhập điểm\n👨‍💼 **Admin:** Gợi ý phân phòng thi, kiểm tra lỗi, hướng dẫn sử dụng\n\nHãy đặt câu hỏi để tôi hỗ trợ bạn nhé!',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<React.ElementRef<typeof ScrollArea>>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto scroll to bottom when new message arrives
  useEffect(() => {
    if (!isMinimized && messages.length > 0) {
      // Use setTimeout to ensure DOM is updated after message render
      const timer = setTimeout(() => {
        if (scrollAreaRef.current) {
          const scrollContainer = (scrollAreaRef.current as any)?.querySelector?.('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, isMinimized]);

  // Focus input when chatbox opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input.trim();
    setInput('');
    setLoading(true);

    try {
      const response = await aiChatApi.sendMessage(messageText);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.text || 'Xin lỗi, tôi không hiểu câu hỏi của bạn.',
        isUser: false,
        timestamp: new Date(),
        data: response.data,
        action: response.action,
      };

      setMessages((prev) => [...prev, botMessage]);

      // Handle navigation action - sử dụng React Router thay vì window.location
      if (response.action === 'navigate') {
        const path = response.path || response.data?.path;
        if (path) {
          // Chỉ navigate nếu user muốn (có thể thêm confirm dialog)
          setTimeout(() => {
            navigate(path);
          }, 1500);
        }
      }
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại sau.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      toast({
        title: 'Lỗi',
        description: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
          aria-label="Mở AI Chat"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 transition-all duration-300',
        isMinimized ? 'w-80' : 'w-96'
      )}
    >
      <Card className="shadow-2xl border-2 h-[600px] flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Trợ lý</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMinimized(!isMinimized)}
              aria-label={isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
            >
              {isMinimized ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <Minimize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
                <div className="p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        message.isUser ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-4 py-2',
                          message.isUser
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {formatText(message.text)}
                        </div>
                        {message.data && (
                          <div className="mt-2 text-xs opacity-80">
                            {JSON.stringify(message.data, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-current rounded-full animate-bounce" />
                          <div className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="h-2 w-2 bg-current rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t p-4 flex-shrink-0">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend(e);
                  }}
                  className="flex gap-2"
                >
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhập câu hỏi của bạn..."
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

