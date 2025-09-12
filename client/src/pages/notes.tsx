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
import { getCurrentUser, getToken, removeToken } from '@/lib/auth';
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

  // Fetch notes
  const { data: notes = [], isLoading: notesLoading, refetch } = useQuery<Note[]>({
    queryKey: ['/api/notes'],
    enabled: !!user,
  });

  // Fetch tenant info
  const { data: tenant } = useQuery({
    queryKey: [`/api/tenants/${user.tenantSlug}`],
    enabled: !!user,
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: NoteFormData) => apiRequest('POST', '/api/notes', data),
    onSuccess: () => {
      toast({ title: "Success", description: "Note created successfully!" });
      setNoteModalOpen(false);
      setNoteForm({ title: '', content: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create note",
        variant: "destructive",
      });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteFormData }) =>
      apiRequest('PUT', `/api/notes/${id}`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Note updated successfully!" });
      setNoteModalOpen(false);
      setEditingNote(null);
      setNoteForm({ title: '', content: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update note",
        variant: "destructive",
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/notes/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Note deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  // Upgrade tenant mutation
  const upgradeMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/tenants/${user.tenantSlug}/upgrade`, {}),
    onSuccess: () => {
      toast({ title: "Success", description: "Upgraded to Pro plan!" });
      queryClient.invalidateQueries({ queryKey: [`/api/tenants/${user.tenantSlug}`] });
      window.location.reload(); // Refresh to get new JWT with updated plan
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upgrade",
        variant: "destructive",
      });
    },
  });

  // Invite user mutation
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiRequest('POST', `/api/tenants/${user.tenantSlug}/invite`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "User invited successfully!" });
      setInviteModalOpen(false);
      setInviteForm({ email: '', role: 'member' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to invite user",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    removeToken();
    setLocation('/login');
  };

  const handleCreateNote = () => {
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

  // Calculate plan info
  const planLimit = 3; // Free plan limit
  const notesCount = notes.length;
  const isFreePlan = true; // We'll get this from tenant data when available
  const showPlanWarning = isFreePlan && notesCount >= planLimit - 1;

  if (notesLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left side - Logo and tenant info */}
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
                    Free Plan
                  </span>
                </div>
              </div>
            </div>

            {/* Right side - User info and actions */}
            <div className="flex items-center space-x-4">
              {/* Plan Upgrade CTA */}
              {isFreePlan && (
                <Button
                  variant="outline"
                  className="hidden sm:inline-flex items-center text-primary bg-primary/10 hover:bg-primary/20"
                  onClick={() => upgradeMutation.mutate()}
                  disabled={upgradeMutation.isPending}
                  data-testid="button-upgrade"
                >
                  <Star className="text-xs mr-2" size={12} />
                  Upgrade to Pro
                </Button>
              )}

              {/* User info */}
              <div className="flex items-center space-x-3">
                <div className="text-right text-sm">
                  <div className="text-foreground font-medium">{user.email}</div>
                  <div className="flex items-center space-x-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Shield className="text-xs mr-1" size={12} />
                      {user.role}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-8 h-8 p-0"
                  data-testid="button-logout"
                >
                  <LogOut className="text-sm" size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">My Notes</h2>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span data-testid="text-notes-count">{notesCount} of {isFreePlan ? planLimit : '∞'} notes used</span>
              <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
              <span>{isFreePlan ? 'Free plan limit' : 'Pro plan'}</span>
            </div>
          </div>
          
          <div className="mt-4 sm:mt-0 flex space-x-3">
            {/* Admin-only invite button */}
            {user.role === 'admin' && (
              <Button
                variant="outline"
                onClick={() => setInviteModalOpen(true)}
                data-testid="button-invite"
              >
                <UserPlus className="text-sm mr-2" size={16} />
                Invite User
              </Button>
            )}
            
            <Button 
              onClick={handleCreateNote}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-create-note"
            >
              <Plus className="text-sm mr-2" size={16} />
              New Note
            </Button>
          </div>
        </div>

        {/* Plan Limit Warning */}
        {showPlanWarning && (
          <Card className="bg-amber-50 border-amber-200 mb-6">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="text-amber-500 mr-3">⚠️</div>
                  <div>
                    <h3 className="text-sm font-medium text-amber-800">Approaching Plan Limit</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      You're using {notesCount} of {planLimit} available notes on your free plan.
                    </p>
                  </div>
                </div>
                <Button
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={() => upgradeMutation.mutate()}
                  disabled={upgradeMutation.isPending}
                >
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow" data-testid={`card-note-${note.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-medium text-foreground truncate" data-testid={`text-note-title-${note.id}`}>
                    {note.title}
                  </h3>
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditNote(note)}
                      className="w-8 h-8 p-0"
                      data-testid={`button-edit-${note.id}`}
                    >
                      <Edit className="text-sm" size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id)}
                      className="w-8 h-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      data-testid={`button-delete-${note.id}`}
                    >
                      <Trash2 className="text-sm" size={14} />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm line-clamp-3 mb-4" data-testid={`text-note-content-${note.id}`}>
                  {note.content}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Create New Note Card */}
          <Card 
            className="border-2 border-dashed border-border hover:border-primary transition-colors cursor-pointer min-h-[180px] flex items-center justify-center"
            onClick={handleCreateNote}
            data-testid="card-create-note"
          >
            <CardContent className="text-center text-muted-foreground hover:text-primary transition-colors">
              <Plus className="text-3xl mb-3 mx-auto" size={48} />
              <h3 className="text-lg font-medium mb-1">Create New Note</h3>
              <p className="text-sm">Add a new note to your collection</p>
            </CardContent>
          </Card>
        </div>

        {/* Empty State */}
        {notes.length === 0 && (
          <div className="text-center py-12" data-testid="empty-state">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <StickyNote className="text-3xl text-muted-foreground" size={48} />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No notes yet</h3>
            <p className="text-muted-foreground mb-6">Create your first note to get started</p>
            <Button onClick={handleCreateNote} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="text-sm mr-2" size={16} />
              Create First Note
            </Button>
          </div>
        )}
      </main>

      {/* Note Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="max-w-2xl" data-testid="modal-note">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Create New Note'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleNoteSubmit} className="space-y-4" data-testid="form-note">
            <div>
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={noteForm.title}
                onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter note title..."
                required
                data-testid="input-note-title"
              />
            </div>
            
            <div>
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                value={noteForm.content}
                onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your note content here..."
                rows={10}
                className="resize-vertical"
                required
                data-testid="textarea-note-content"
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setNoteModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
                data-testid="button-save-note"
              >
                {editingNote ? 'Update Note' : 'Save Note'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Modal */}
      {user.role === 'admin' && (
        <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
          <DialogContent data-testid="modal-invite">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleInviteSubmit} className="space-y-4" data-testid="form-invite">
              <div>
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                  required
                  data-testid="input-invite-email"
                />
              </div>
              
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteForm.role} onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Card className="bg-muted">
                <CardContent className="pt-3">
                  <p className="text-sm text-muted-foreground">
                    ℹ️ Default password will be "password". User should change it after first login.
                  </p>
                </CardContent>
              </Card>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invite">
                  Send Invite
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
