import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, X, Minimize2, Maximize2, MessageCircle } from 'lucide-react';
import { aiChatApi, ChatMessage } from '@/services/aiChatApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Simple markdown-like formatting helper
const formatText = (text: string): React.ReactNode => {
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
}

interface AIFloatingChatProps {
  className?: string;
}

/**
 * Tạo greeting message dựa trên role và flags
 */
function getGreetingMessage(role: string, teacherFlags?: any): string {
  // Học sinh
  if (role === 'student') {
    return `Xin chào! 👋 Tôi là trợ lý AI của hệ thống quản lý trường học.

Tôi có thể hỗ trợ bạn:

📅 **Lịch thi:** Xem lịch thi, phòng thi, thời gian thi
📊 **Điểm số:** Tra cứu điểm các môn học
📚 **Thời khóa biểu:** Xem lịch học hàng tuần
📧 **Thông tin cá nhân:** Email, mã số học sinh, lớp học

💡 Hãy đặt câu hỏi bất kỳ, tôi sẽ hỗ trợ bạn ngay!`;
  }

  // Giáo viên
  if (role === 'teacher') {
    const flags = teacherFlags || {};
    
    // Ban Giám Hiệu (BGH)
    if (flags.isLeader) {
      return `Xin chào! 👋 Tôi là trợ lý AI của hệ thống quản lý trường học.

Với vai trò **Ban Giám Hiệu**, tôi có thể hỗ trợ bạn:

📊 **Thống kê:** Thống kê toàn trường, lớp học, môn học
👥 **Tìm kiếm:** Tìm học sinh, giáo viên, lớp học
📅 **Quản lý lịch:** Xem thời khóa biểu, lịch thi, kiểm tra xung đột
🏢 **Quản lý phòng:** Kiểm tra phòng trống, xung đột phòng thi
📝 **Gợi ý:** Gợi ý phân phòng thi, tạo thời khóa biểu
🔔 **Thông báo:** Sinh thông báo tự động

💡 Hãy đặt câu hỏi bất kỳ, tôi sẽ hỗ trợ bạn ngay!`;
    }
    
    // Quản lý Bộ môn (QLBM)
    if (flags.isDepartmentHead) {
      return `Xin chào! 👋 Tôi là trợ lý AI của hệ thống quản lý trường học.

Với vai trò **Quản lý Bộ môn**, tôi có thể hỗ trợ bạn:

👨‍🏫 **Quản lý giáo viên:** Tìm giáo viên trong tổ, xem lịch dạy, khối lượng công việc
📚 **Quản lý môn học:** Xem thống kê môn học, lớp dạy môn
📅 **Lịch dạy:** Xem thời khóa biểu, kiểm tra lịch rảnh giáo viên
👥 **Tìm kiếm:** Tìm học sinh, giáo viên, lớp học
📝 **Hướng dẫn:** Cách sử dụng hệ thống, quản lý tổ bộ môn

💡 Hãy đặt câu hỏi bất kỳ, tôi sẽ hỗ trợ bạn ngay!`;
    }
    
    // Giáo viên Chủ nhiệm (GVCN)
    if (flags.isHomeroom) {
      return `Xin chào! 👋 Tôi là trợ lý AI của hệ thống quản lý trường học.

Với vai trò **Giáo viên Chủ nhiệm**, tôi có thể hỗ trợ bạn:

👥 **Quản lý lớp:** Xem danh sách học sinh lớp chủ nhiệm, thống kê lớp
📅 **Thời khóa biểu:** Xem TKB lớp chủ nhiệm
📊 **Điểm số:** Xem bảng điểm lớp, hướng dẫn nhập điểm
📝 **Điểm danh:** Hướng dẫn điểm danh, quản lý hạnh kiểm
👨‍🏫 **Lịch dạy:** Xem lịch dạy các lớp đang dạy
🔔 **Thông báo:** Gửi thông báo cho lớp chủ nhiệm

💡 Hãy đặt câu hỏi bất kỳ, tôi sẽ hỗ trợ bạn ngay!`;
    }
    
    // Giáo viên Bộ môn (GVBM)
    return `Xin chào! 👋 Tôi là trợ lý AI của hệ thống quản lý trường học.

Với vai trò **Giáo viên Bộ môn**, tôi có thể hỗ trợ bạn:

👥 **Tra cứu học sinh:** Tìm học sinh trong các lớp đang dạy
📅 **Lịch dạy:** Xem thời khóa biểu, lịch dạy của bạn
📊 **Điểm số:** Hướng dẫn nhập điểm, xem bảng điểm
📚 **Quản lý lớp:** Xem danh sách lớp đang dạy, thông tin lớp
📝 **Hướng dẫn:** Cách sử dụng hệ thống, nhập điểm, quản lý

💡 Hãy đặt câu hỏi bất kỳ, tôi sẽ hỗ trợ bạn ngay!`;
  }

  // Admin
  if (role === 'admin') {
    return `Xin chào! 👋 Tôi là trợ lý AI của hệ thống quản lý trường học.

Với vai trò **Quản trị viên**, tôi có thể hỗ trợ bạn:

👥 **Tìm kiếm:** Tìm học sinh, giáo viên, lớp học theo nhiều tiêu chí
📅 **Quản lý kỳ thi:** Kiểm tra xung đột phòng thi, gợi ý phân phòng thi
📚 **Quản lý thời khóa biểu:** Kiểm tra xung đột, gợi ý tạo TKB tự động
🏢 **Quản lý phòng:** Tìm phòng trống, kiểm tra xung đột phòng học
📊 **Thống kê:** Thống kê lớp, môn học, hệ thống tổng quan
🔔 **Thông báo:** Sinh thông báo tự động cho các đối tượng
👨‍🏫 **Quản lý giáo viên:** Tìm giáo viên rảnh, xem khối lượng công việc

💡 Hãy đặt câu hỏi bất kỳ, tôi sẽ hỗ trợ bạn ngay!`;
  }

  // Default
  return `Xin chào! 👋 Tôi là trợ lý AI của hệ thống quản lý trường học.

Tôi có thể hỗ trợ bạn tra cứu thông tin, xem lịch, tìm kiếm và hướng dẫn sử dụng hệ thống.

💡 Hãy đặt câu hỏi bất kỳ, tôi sẽ hỗ trợ bạn ngay!`;
}

export function AIFloatingChat({ className }: AIFloatingChatProps) {
  const { backendUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Tạo greeting message dựa trên role và flags
  const greetingMessage = useMemo(() => {
    if (!backendUser) {
      return getGreetingMessage('student');
    }
    return getGreetingMessage(backendUser.role, backendUser.teacherFlags);
  }, [backendUser]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: greetingMessage,
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<React.ElementRef<typeof ScrollArea>>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Cập nhật greeting message khi role/flags thay đổi (chỉ khi chưa có tin nhắn nào khác)
  useEffect(() => {
    setMessages((prevMessages) => {
      // Chỉ cập nhật nếu chỉ có greeting message và nó khác với greeting mới
      if (prevMessages.length === 1 && prevMessages[0].id === '1' && prevMessages[0].text !== greetingMessage) {
        return [
          {
            id: '1',
            text: greetingMessage,
            isUser: false,
            timestamp: new Date(),
          },
        ];
      }
      return prevMessages;
    });
  }, [greetingMessage]);

  // Auto scroll to bottom when new message arrives
  useEffect(() => {
    if (isOpen && !isMinimized && messages.length > 0) {
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
  }, [messages, isOpen, isMinimized]);

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
      // Convert messages to ChatMessage format for API
      const conversationHistory: ChatMessage[] = messages.map(msg => ({
        role: msg.isUser ? 'user' : 'assistant',
        text: msg.text,
        isUser: msg.isUser,
      }));

      const response = await aiChatApi.sendMessage(messageText, conversationHistory);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.text || 'Xin lỗi, tôi không thể trả lời câu hỏi này.',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.',
        variant: 'destructive',
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại sau.',
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend(e);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setIsMinimized(false);
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={toggleChat}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          aria-label="Mở chatbot AI"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className={cn(
          'w-[400px] shadow-2xl transition-all duration-300',
          isMinimized ? 'h-[60px]' : 'h-[600px]'
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <h3 className="font-semibold text-lg">Trợ lý AI</h3>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMinimize}
                className="h-8 w-8 text-white hover:bg-white/20"
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
                onClick={handleClose}
                className="h-8 w-8 text-white hover:bg-white/20"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <CardContent className="p-0 flex flex-col h-[calc(600px-60px)]">
              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
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
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                        )}
                      >
                        <div className="text-sm whitespace-pre-wrap">
                          {formatText(message.text)}
                        </div>
                        <div
                          className={cn(
                            'text-xs mt-1',
                            message.isUser
                              ? 'text-blue-100'
                              : 'text-gray-500 dark:text-gray-400'
                          )}
                        >
                          {message.timestamp.toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t p-4 bg-gray-50 dark:bg-gray-900">
                <div className="flex space-x-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Nhập câu hỏi của bạn..."
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    size="icon"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

