import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Store, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatMessages, ChatMessage } from '@/hooks/useChatMessages';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderChatPanelProps {
    orderId: string;
    storeId: string;
    customerName: string;
    storeName: string;
    isShopper?: boolean;
}

const OrderChatPanel: React.FC<OrderChatPanelProps> = ({
    orderId,
    storeId,
    customerName,
    storeName,
    isShopper = false
}) => {
    const [newMessage, setNewMessage] = useState('');
    const { messages, loading, sendMessage, markAsRead } = useChatMessages(orderId, storeId, isShopper);
    const scrollRef = useRef<HTMLDivElement>(null);
    const senderRole = isShopper ? 'customer' : 'store';
    const senderName = isShopper ? customerName : storeName;

    useEffect(() => {
        // Scroll to bottom when messages change
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
        markAsRead();
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await sendMessage(newMessage, senderName, senderRole);
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden shadow-sm">
            <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                    <h3 className="font-semibold text-sm">Chat del Pedido</h3>
                    <p className="text-xs text-muted-foreground">
                        {isShopper ? `Negocio: ${storeName}` : `Cliente: ${customerName}`}
                    </p>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                    {messages.length === 0 && !loading && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No hay mensajes aún. ¡Inicia la conversación!
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isMe = msg.sender_role === senderRole;
                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                                        isMe
                                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                                            : 'bg-muted text-muted-foreground rounded-tl-none'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                        {msg.sender_role === 'store' ? (
                                            <Store className="h-3 w-3" />
                                        ) : (
                                            <User className="h-3 w-3" />
                                        )}
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {msg.sender_name}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed">{msg.message}</p>
                                    <div className="text-[9px] text-right mt-1 opacity-50">
                                        {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            <form onSubmit={handleSend} className="p-3 border-t bg-muted/10 flex gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0">
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
    );
};

export default OrderChatPanel;
