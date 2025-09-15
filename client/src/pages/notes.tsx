import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser, removeToken } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { StickyNote, Plus, Edit, Trash2, UserPlus, Star, Shield, Crown, LogOut } from 'lucide-react';
import { Loading } from '@/components/ui/loading';
import type { Note } from '@shared/schema';

interface NoteFormData {
  title: string;
  content: string;
}

export default function Notes() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = getCurrentUser();

  // Modal states
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Form states
  const [noteForm, setNoteForm] = useState<NoteFormData>({ title: '', content: '' });
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' });

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      setLocation('/login');
    }
  }, [user, setLocation]);

  if (!user) {
    return <Loading />;
  }

  // Fetch notes (user-scoped cache key + explicit queryFn)
  const {
    data: notes = [],
    isLoading: notesLoading,
    refetch: refetchNotes
  } = useQuery<Note[]>({
    // scoped per-user so different users in same tenant don't share cache
    queryKey: ['userNotes', user?.userId],
    enabled: !!user,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/notes');
      return (await res.json()) as Note[];
    },
  });

  // Fetch tenant info
  const { data: tenant } = useQuery({
    queryKey: [`/api/tenants/${user.tenantSlug}`],
    enabled: !!user,
  });

  // Plan info
  const isFreePlan = tenant?.plan === 'free' || !tenant?.plan;
  const planLimit = isFreePlan ? 3 : Infinity;
  const notesCount = notes.length;
  const isAtOrOverLimit = isFreePlan && notesCount >= planLimit;

  // --- Mutations ---
  const createNoteMutation = useMutation({
    mutationFn: (data: NoteFormData) => apiRequest('POST', '/api/notes', data),
    onSuccess: async (res) => {
      // apiRequest returns Response — parse it if needed
      let data;
      try { data = await res.json(); } catch { data = null; }
      console.log("Create note response:", data);
      toast({ title: "Success", description: "Note created successfully!" });
      setNoteModalOpen(false);
      setNoteForm({ title: '', content: '' });
      try { queryClient.invalidateQueries({ queryKey: ['userNotes', user?.userId] }); } catch (e) {}
      refetchNotes();
      try { queryClient.invalidateQueries({ queryKey: [`/api/tenants/${user.tenantSlug}`] }); } catch (e) {}
    },
    onError: async (error: any) => {
      try {
        if (error instanceof Response) {
          const text = await error.text();
          console.error('Create note failed - server response:', text);
          toast({ title: "Error", description: text || "Failed to create note", variant: "destructive" });
          return;
        }
      } catch (_) {}
      const msg = error?.message || error?.response?.data?.message || "Failed to create note";
      if (msg.includes("Free plan limit")) {
        toast({ title: "Plan limit reached", description: msg, variant: "destructive" });
        setUpgradeModalOpen(true);
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteFormData }) =>
      apiRequest('PUT', `/api/notes/${id}`, data),
    onSuccess: async (res) => {
      try { await res.json(); } catch {}
      toast({ title: "Success", description: "Note updated successfully!" });
      setNoteModalOpen(false);
      setEditingNote(null);
      setNoteForm({ title: '', content: '' });
      try { queryClient.invalidateQueries({ queryKey: ['userNotes', user?.userId] }); } catch (e) {}
      refetchNotes();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update note", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/notes/${id}`),
    onSuccess: async () => {
      toast({ title: "Success", description: "Note deleted successfully!" });
      try { queryClient.invalidateQueries({ queryKey: ['userNotes', user?.userId] }); } catch (e) {}
      refetchNotes();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete note", variant: "destructive" });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/tenants/${user.tenantSlug}/upgrade`, {}),
    onSuccess: () => {
      toast({ title: "Success", description: "Upgraded to Pro plan!" });
      setUpgradeModalOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/tenants/${user.tenantSlug}`] });
      try { queryClient.invalidateQueries({ queryKey: ['userNotes', user?.userId] }); } catch(e){}
      window.location.reload();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to upgrade", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiRequest('POST', `/api/tenants/${user.tenantSlug}/invite`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "User invited successfully!" });
      setInviteModalOpen(false);
      setInviteForm({ email: '', role: 'member' });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to invite user", variant: "destructive" });
    },
  });

  // --- Handlers ---
  const handleLogout = () => {
    removeToken();
    // clear any user-specific caches on logout
    try { queryClient.removeQueries({ queryKey: ['userNotes', user?.userId] }); } catch {}
    setLocation('/login');
  };

  const handleCreateNote = () => {
    if (isAtOrOverLimit) {
      toast({ title: "Plan limit reached", description: "Upgrade to Pro to create more notes.", variant: "destructive" });
      setUpgradeModalOpen(true);
      return;
    }
    setEditingNote(null);
    setNoteForm({ title: '', content: '' });
    setNoteModalOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteForm({ title: note.title, content: note.content });
    setNoteModalOpen(true);
  };

  const handleDeleteNote = (id: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      deleteNoteMutation.mutate(id);
    }
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingNote) {
      updateNoteMutation.mutate({ id: editingNote.id, data: noteForm });
    } else {
      createNoteMutation.mutate(noteForm);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate(inviteForm);
  };

  if (notesLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <StickyNote className="text-lg text-primary-foreground" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">NotesApp</h1>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>{user.tenantSlug.toUpperCase()} Corp</span>
                  <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <Crown className="text-xs mr-1" size={12} />
                    {isFreePlan ? 'Free Plan' : 'Pro Plan'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isFreePlan && (
                <Button
                  variant="outline"
                  onClick={() => setUpgradeModalOpen(true)}
                  disabled={upgradeMutation.isPending}
                >
                  <Star className="text-xs mr-2" size={12} />
                  Upgrade to Pro
                </Button>
              )}
              <div className="flex items-center space-x-3">
                <div className="text-right text-sm">
                  <div className="text-foreground font-medium">{user.email}</div>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Shield className="text-xs mr-1" size={12} />
                    {user.role}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">My Notes</h2>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{notesCount} of {isFreePlan ? planLimit : '∞'} notes used</span>
              <span>{isFreePlan ? 'Free plan (per user)' : 'Pro plan'}</span>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            {user.role === 'admin' && (
              <Button variant="outline" onClick={() => setInviteModalOpen(true)}>
                <UserPlus className="mr-2" size={16} />
                Invite User
              </Button>
            )}
            <Button onClick={handleCreateNote}>
              <Plus className="mr-2" size={16} />
              New Note
            </Button>
          </div>
        </div>

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-medium truncate">{note.title}</h3>
                  <div className="flex space-x-1">
                    {(note.userId === user.userId) && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleEditNote(note)}>
                          <Edit size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground text-sm line-clamp-3 mb-4">{note.content}</p>
                <div className="text-xs text-muted-foreground">
                  {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ''}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {notes.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">No notes yet</h3>
            <Button onClick={handleCreateNote}>
              <Plus className="mr-2" size={16} />
              Create First Note
            </Button>
          </div>
        )}
      </main>

      {/* Note Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Create New Note'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleNoteSubmit} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={noteForm.title}
                onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={noteForm.content}
                onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createNoteMutation.isLoading || updateNoteMutation.isLoading}>
                {editingNote ? 'Update Note' : 'Save Note'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      {user.role === 'admin' && (
        <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={inviteForm.role} onValueChange={(v) => setInviteForm(prev => ({ ...prev, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={inviteMutation.isLoading}>Send Invite</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Upgrade Modal */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to Pro</DialogTitle>
          </DialogHeader>
          <p>Your free plan is limited to {planLimit} notes. Upgrade to Pro for unlimited notes.</p>
          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setUpgradeModalOpen(false)}>Cancel</Button>
            <Button onClick={() => upgradeMutation.mutate()} disabled={upgradeMutation.isLoading}>
              {upgradeMutation.isLoading ? "Upgrading..." : "Upgrade Now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
