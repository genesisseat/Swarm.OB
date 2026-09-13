export interface NoteRecord {
  id: string;
  title: string;
  folder: string;
  content: string;
  updatedAt: number;
  createdAt: number;
}

export interface ConversationNote extends NoteRecord {
  type: "chat";
  provider?: string;
  model?: string;
}

export interface SynthesisNote extends NoteRecord {
  type: "synthesis";
  topic?: string;
  transcript?: string;
}

export class NoteService {
  private notes: NoteRecord[] = [];

  public createNote(title: string, folder: string, content = ""): NoteRecord {
    const note: NoteRecord = {
      id: `note-${Date.now()}`,
      title,
      folder,
      content,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };

    this.notes.push(note);
    return note;
  }

  public listNotes(): NoteRecord[] {
    return [...this.notes];
  }

  public saveNote(note: NoteRecord): void {
    const existing = this.notes.findIndex((item) => item.id === note.id);
    if (existing >= 0) {
      this.notes[existing] = note;
    } else {
      this.notes.push(note);
    }
  }
}
