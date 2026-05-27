
import React, { useRef, useState, useEffect } from 'react';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Lock, Plus, LogOut, Mail, Linkedin, Instagram, GraduationCap, Trash2, Edit2, Upload, FileText, Video, ImageIcon, LogIn, ShieldCheck, GripVertical, X } from 'lucide-react';
import SakuraBackground from './components/SakuraBackground';
import { PortfolioData, Section, Post, MediaItem, ProfileData } from './types';
import profilePic from './profile.jpg';
import resumePdf from './resume1.pdf';
import { db, storage } from './firebase';

const FIXED_DEGREE = 'Bachelor of Engineering in Computer Engineering';
const DEFAULT_BIO = 'I am a Computer Engineering student with a passion for building clean, user-friendly digital experiences.';
const DEFAULT_COLLEGE = 'SCOE';
const PORTFOLIO_DOC_ID = 'portfoliokajol';
const RESUME_SECTION_TITLE = 'Resume';
const INTERNSHIP_SECTION_TITLE = 'Internship';
const INTERNSHIP_SECTION_ALIASES = new Set(['internship', 'intership']);
const DREAMVENTX_OFFER_LETTER_URL = '/DREAMVENTX OFFER LETTER.pdf';
const DREAMVENTX_OFFER_LETTER_NAME = 'DREAMVENTX OFFER LETTER.pdf';

const INITIAL_DATA: PortfolioData = {
  profile: {
    name: 'Kajol Tarate',
    email: 'kajolrt11@gmail.com',
    linkedin: 'linkedin.com/in/kajol-tarate-1911dtaz',
    instagram: 'instagram.com/kajoltarate11',
    degreeDetails: FIXED_DEGREE,
    profilePicture: profilePic,
    bio: DEFAULT_BIO,
    college: DEFAULT_COLLEGE,
  },
  sections: [
    {
      id: 'default-2',
      title: 'Skills',
      posts: [
        {
          id: 'skill-1',
          content: 'Japanese',
          media: [],
          timestamp: Date.now(),
        },
        {
          id: 'skill-2',
          content: 'Technical writing',
          media: [],
          timestamp: Date.now(),
        },
        {
          id: 'skill-3',
          content: 'MERN stack',
          media: [],
          timestamp: Date.now(),
        }
      ],
    }
  ]
};

const SECRET_CODE = "DAZAI4teru";

interface FeedbackItem {
  id: string;
  name: string;
  email: string;
  thoughts: string;
  createdAt: number | null;
}

const ensureResumeSection = (sections: Section[]): Section[] => {
  const resumeMedia: MediaItem = {
    id: 'resume-media-1',
    type: 'pdf',
    url: resumePdf,
    name: 'RESUME.pdf',
  };

  const resumePost: Post = {
    id: 'resume-post-1',
    content: 'RESUME.pdf',
    media: [resumeMedia],
    timestamp: Date.now(),
  };

  const resumeIndex = sections.findIndex(
    (section) => section.title.trim().toLowerCase() === RESUME_SECTION_TITLE.toLowerCase()
  );

  if (resumeIndex === -1) {
    return [
      ...sections,
      {
        id: 'resume-section-1',
        title: RESUME_SECTION_TITLE,
        posts: [resumePost],
      },
    ];
  }

  const updatedSections = [...sections];
  const existingResume = updatedSections[resumeIndex];
  const hasResumePdf = existingResume.posts.some((post) =>
    post.media.some((media) => media.type === 'pdf' && (media.name === 'RESUME.pdf' || media.url === resumePdf))
  );

  if (!hasResumePdf) {
    updatedSections[resumeIndex] = {
      ...existingResume,
      posts: [resumePost, ...existingResume.posts],
    };
  }

  return updatedSections;
};

const ensureInternshipSection = (sections: Section[]): Section[] => {
  const offerLetterMedia: MediaItem = {
    id: 'dreamventx-offer-letter-media-1',
    type: 'pdf',
    url: DREAMVENTX_OFFER_LETTER_URL,
    name: DREAMVENTX_OFFER_LETTER_NAME,
  };

  const offerLetterPost: Post = {
    id: 'dreamventx-offer-letter-post-1',
    title: 'Dreamventx Offer Letter',
    content: 'Offer Letter',
    media: [offerLetterMedia],
    timestamp: Date.now(),
  };

  const internshipIndex = sections.findIndex((section) =>
    INTERNSHIP_SECTION_ALIASES.has(section.title.trim().toLowerCase())
  );

  if (internshipIndex === -1) {
    return [
      ...sections,
      {
        id: 'internship-section-1',
        title: INTERNSHIP_SECTION_TITLE,
        posts: [offerLetterPost],
      },
    ];
  }

  const updatedSections = [...sections];
  const existingInternship = updatedSections[internshipIndex];
  const hasOfferLetter = existingInternship.posts.some((post) =>
    post.media.some(
      (media) =>
        media.type === 'pdf' &&
        (media.name === DREAMVENTX_OFFER_LETTER_NAME || media.url === DREAMVENTX_OFFER_LETTER_URL)
    )
  );

  if (!hasOfferLetter) {
    updatedSections[internshipIndex] = {
      ...existingInternship,
      posts: [offerLetterPost, ...existingInternship.posts],
    };
  }

  return updatedSections;
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [portfolio, setPortfolio] = useState<PortfolioData>(INITIAL_DATA);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [reorderPostsSectionId, setReorderPostsSectionId] = useState<string | null>(null);
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [activePostModal, setActivePostModal] = useState<string | null>(null); // sectionId
  const [editingPost, setEditingPost] = useState<{post: Post, sectionId: string} | null>(null);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState<MediaItem[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video' | 'pdf'>('image');
  const [expandedPost, setExpandedPost] = useState<{ post: Post; sectionTitle: string } | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showAdminFeedbackModal, setShowAdminFeedbackModal] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackForm, setFeedbackForm] = useState({
    name: '',
    email: '',
    thoughts: '',
  });
  const postTitleInputRef = useRef<HTMLInputElement>(null);
  const postContentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingPost) {
      setNewPostTitle(editingPost.post.title ?? '');
      setNewPostContent(editingPost.post.content);
      setNewPostMedia([...editingPost.post.media]);
      setActivePostModal(editingPost.sectionId);
    }
  }, [editingPost]);

  const renderPdfPreview = (media: MediaItem, compact = false) => (
    <div className={`relative w-full overflow-hidden bg-gradient-to-br from-pink-50 via-white to-rose-50 ${compact ? 'h-full' : 'min-h-[420px]'}`}>
      <iframe
        src={`${media.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        title={media.name || 'PDF preview'}
        className="min-h-[240px] h-full w-full border-0 pointer-events-none"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-white via-white/95 to-transparent px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-pink-600">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate text-xs font-semibold">{media.name || 'PDF file'}</span>
        </div>
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="shrink-0 rounded-lg bg-pink-500 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-pink-600"
        >
          Open PDF
        </a>
      </div>
    </div>
  );

  const escapeHtml = (input: string) =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const getFormattedHtml = (input: string) =>
    escapeHtml(input)
      .replace(/__(.+?)__/g, '<u>$1</u>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');

  const applyFormat = (target: 'title' | 'content', marker: '**' | '*' | '__') => {
    const inputElement = target === 'title' ? postTitleInputRef.current : postContentInputRef.current;
    const textValue = target === 'title' ? newPostTitle : newPostContent;
    const setTextValue = target === 'title' ? setNewPostTitle : setNewPostContent;

    if (!inputElement) return;

    const start = inputElement.selectionStart ?? textValue.length;
    const end = inputElement.selectionEnd ?? textValue.length;
    const selectedText = textValue.slice(start, end);
    const wrappedSelection = selectedText ? `${marker}${selectedText}${marker}` : `${marker}${marker}`;
    const nextValue = textValue.slice(0, start) + wrappedSelection + textValue.slice(end);

    setTextValue(nextValue);

    requestAnimationFrame(() => {
      inputElement.focus();
      const nextCursor = start + marker.length;
      const nextSelectionEnd = selectedText ? end + marker.length : nextCursor;
      inputElement.setSelectionRange(nextCursor, nextSelectionEnd);
    });
  };

  const normalizePortfolio = (data: PortfolioData): PortfolioData => ({
    ...data,
    sections: ensureInternshipSection(ensureResumeSection(data.sections)),
    profile: {
      ...data.profile,
      profilePicture: profilePic,
      degreeDetails: FIXED_DEGREE,
      bio: data.profile.bio ?? DEFAULT_BIO,
      college: data.profile.college ?? DEFAULT_COLLEGE,
    },
  });

  useEffect(() => {
    let isMounted = true;

    const loadPortfolio = async () => {
      try {
        const ref = doc(db, 'portfolios', PORTFOLIO_DOC_ID);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const payload = snap.data()?.data as PortfolioData | undefined;
          if (payload) {
            const normalized = normalizePortfolio(payload);
            if (isMounted) {
              setPortfolio(normalized);
              localStorage.setItem('sakura_portfolio_v1', JSON.stringify(normalized));
            }
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load portfolio from Firestore:', err);
      }
      if (isMounted) {
        setPortfolio(normalizePortfolio(INITIAL_DATA));
      }
    };

    loadPortfolio();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setFeedbackItems([]);
      return;
    }

    const feedbackRef = collection(db, 'portfolios', PORTFOLIO_DOC_ID, 'feedback');
    const feedbackQuery = query(feedbackRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      feedbackQuery,
      (snapshot) => {
        const items = snapshot.docs.map((feedbackDoc) => {
          const payload = feedbackDoc.data() as {
            name?: string;
            email?: string;
            thoughts?: string;
            createdAt?: { toDate: () => Date };
          };

          return {
            id: feedbackDoc.id,
            name: payload.name ?? '',
            email: payload.email ?? '',
            thoughts: payload.thoughts ?? '',
            createdAt: payload.createdAt ? payload.createdAt.toDate().getTime() : null,
          };
        });
        setFeedbackItems(items);
      },
      (err) => {
        console.error('Failed to load feedback:', err);
      }
    );

    return () => unsubscribe();
  }, [isLoggedIn]);

  const savePortfolio = (data: PortfolioData) => {
    const normalized = normalizePortfolio(data);
    setPortfolio(normalized);

    const ref = doc(db, 'portfolios', PORTFOLIO_DOC_ID);
    void setDoc(
      ref,
      { data: normalized, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch((err) => {
      console.error('Failed to save portfolio to Firestore:', err);
    });
  };

  const resetToDefaults = () => {
    if (!confirm('Reset all data to defaults? This will overwrite Firestore.')) return;
    savePortfolio(INITIAL_DATA);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (authCode.toUpperCase() === SECRET_CODE.toUpperCase()) {
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setAuthCode('');
    } else {
      alert("Invalid Access Code");
    }
  };

  const handleProfileUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updatedProfile: ProfileData = {
      ...portfolio.profile,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      linkedin: formData.get('linkedin') as string,
      instagram: formData.get('instagram') as string,
      degreeDetails: formData.get('degree') as string,
      bio: formData.get('bio') as string,
      college: formData.get('college') as string,
    };
    savePortfolio({ ...portfolio, profile: updatedProfile });
    setIsEditingProfile(false);
  };

  const addSection = () => {
    if (!newSectionTitle) return;
    const newSection: Section = {
      id: Date.now().toString(),
      title: newSectionTitle,
      posts: [],
    };
    savePortfolio({ ...portfolio, sections: [...portfolio.sections, newSection] });
    setNewSectionTitle('');
    setShowSectionModal(false);
  };

  const deleteSection = (id: string) => {
    if (!confirm("Are you sure you want to delete this section?")) return;
    savePortfolio({ ...portfolio, sections: portfolio.sections.filter(s => s.id !== id) });
  };

  const reorderSections = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;

    const fromIndex = portfolio.sections.findIndex((section) => section.id === draggedId);
    const toIndex = portfolio.sections.findIndex((section) => section.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const updatedSections = [...portfolio.sections];
    const [movedSection] = updatedSections.splice(fromIndex, 1);
    updatedSections.splice(toIndex, 0, movedSection);

    savePortfolio({ ...portfolio, sections: updatedSections });
  };

  const reorderPosts = (sectionId: string, draggedPostId: string, targetPostId: string) => {
    if (draggedPostId === targetPostId) return;

    const updatedSections = portfolio.sections.map((section) => {
      if (section.id !== sectionId) return section;

      const fromIndex = section.posts.findIndex((post) => post.id === draggedPostId);
      const toIndex = section.posts.findIndex((post) => post.id === targetPostId);
      if (fromIndex === -1 || toIndex === -1) return section;

      const updatedPosts = [...section.posts];
      const [movedPost] = updatedPosts.splice(fromIndex, 1);
      updatedPosts.splice(toIndex, 0, movedPost);
      return { ...section, posts: updatedPosts };
    });

    savePortfolio({ ...portfolio, sections: updatedSections });
  };

  const handleAddMediaLink = () => {
    const trimmed = newMediaUrl.trim();
    if (!trimmed) return;

    const name = trimmed.split('/').pop() || 'media';
    const newItem: MediaItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: newMediaType,
      url: trimmed,
      name,
    };
    setNewPostMedia((prev) => [...prev, newItem]);
    setNewMediaUrl('');
  };

  const createPost = (sectionId: string) => {
    const newPost: Post = {
      id: Date.now().toString(),
      title: newPostTitle.trim(),
      content: newPostContent,
      media: newPostMedia,
      timestamp: Date.now(),
    };

    const updatedSections = portfolio.sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, posts: [newPost, ...s.posts] };
      }
      return s;
    });

    savePortfolio({ ...portfolio, sections: updatedSections });
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostMedia([]);
    setActivePostModal(null);
  };

  const updatePost = (sectionId: string, postId: string) => {
    const updatedPost: Post = {
      ...editingPost!.post,
      title: newPostTitle.trim(),
      content: newPostContent,
      media: newPostMedia,
    };

    const updatedSections = portfolio.sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, posts: s.posts.map(p => p.id === postId ? updatedPost : p) };
      }
      return s;
    });

    savePortfolio({ ...portfolio, sections: updatedSections });
    setEditingPost(null);
    setActivePostModal(null);
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostMedia([]);
  };

  const deletePost = (sectionId: string, postId: string) => {
    if (!confirm("Delete this post?")) return;
    const updatedSections = portfolio.sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, posts: s.posts.filter(p => p.id !== postId) };
      }
      return s;
    });
    savePortfolio({ ...portfolio, sections: updatedSections });
  };

  const deleteAllPostsInSection = (sectionId: string) => {
    if (!confirm("Delete all posts in this section?")) return;
    const updatedSections = portfolio.sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, posts: [] };
      }
      return s;
    });
    savePortfolio({ ...portfolio, sections: updatedSections });
  };

  const uploadFile = async (file: File): Promise<string> => {
    const storageRef = ref(storage, `media/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', null, reject, () => {
        getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject);
      });
    });
  };

  const submitFeedback = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = feedbackForm.name.trim();
    const email = feedbackForm.email.trim();
    const thoughts = feedbackForm.thoughts.trim();

    if (!name || !email || !thoughts) {
      alert('Please fill all fields.');
      return;
    }

    try {
      setIsSubmittingFeedback(true);
      await addDoc(collection(db, 'portfolios', PORTFOLIO_DOC_ID, 'feedback'), {
        name,
        email,
        thoughts,
        createdAt: serverTimestamp(),
      });
      setFeedbackForm({ name: '', email: '', thoughts: '' });
      setShowFeedbackModal(false);
      alert('Thanks! Your feedback has been submitted.');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      alert('Could not submit feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="relative min-h-screen pb-20">
      <SakuraBackground />
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-serif font-bold text-pink-600">Kajol's Portfolio</h2>
            {isLoggedIn && (
              <span className="flex items-center gap-1 text-[10px] font-bold bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => setShowSectionModal(true)}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-all text-sm font-medium shadow-md"
                >
                  <Plus className="w-4 h-4" /> Create New Section
                </button>
                <button
                  onClick={resetToDefaults}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-all text-sm font-medium shadow-sm"
                >
                  <Trash2 className="w-4 h-4" /> Reset Defaults
                </button>
                <button
                  onClick={() => setShowReorderModal(true)}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white text-pink-500 hover:bg-pink-50 border border-pink-200 rounded-lg transition-all text-sm font-medium shadow-sm"
                >
                  <GripVertical className="w-4 h-4" /> Rearrange Sections
                </button>
                <button
                  onClick={() => setShowAdminFeedbackModal(true)}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white text-pink-500 hover:bg-pink-50 border border-pink-200 rounded-lg transition-all text-sm font-medium shadow-sm"
                >
                  <Mail className="w-4 h-4" /> Feedback ({feedbackItems.length})
                </button>
                <button
                  onClick={() => setIsLoggedIn(false)}
                  className="flex items-center gap-2 p-2 text-pink-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="hidden sm:inline text-xs font-bold uppercase">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center justify-center w-10 h-10 text-pink-500 hover:bg-pink-50 rounded-lg transition-all"
                aria-label="Owner login"
                title="Owner login"
              >
                <LogIn className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 relative z-10 space-y-12">
        {/* Profile Section */}
        <section className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-pink-100">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="relative group flex-shrink-0">
              <img
                src={portfolio.profile.profilePicture}
                alt="Profile"
                className="w-40 h-40 rounded-full object-cover ring-4 ring-pink-100 shadow-lg"
              />
              {isLoggedIn && (
                <button className="absolute bottom-1 right-1 p-2 bg-pink-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex-grow space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">{portfolio.profile.name}</h1>
                  <p className="text-pink-500 font-medium">{portfolio.profile.degreeDetails}</p>
                </div>
                {isLoggedIn && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="p-2 text-gray-400 hover:text-pink-500 hover:bg-pink-50 rounded-full transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="w-4 h-4 text-pink-400" />
                  <span>{portfolio.profile.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <GraduationCap className="w-4 h-4 text-pink-400" />
                  <span>{portfolio.profile.college}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Linkedin className="w-4 h-4 text-pink-400" />
                  <a href={`https://${portfolio.profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="truncate max-w-[200px] hover:text-pink-600 transition-colors">
                    {portfolio.profile.linkedin}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Instagram className="w-4 h-4 text-pink-400" />
                  <a href={`https://${portfolio.profile.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:text-pink-600 transition-colors">
                    {portfolio.profile.instagram}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-pink-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-serif font-bold text-gray-800">Bio</h2>
            {isLoggedIn && (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="p-2 text-gray-400 hover:text-pink-500 hover:bg-pink-50 rounded-full transition-all"
                aria-label="Edit bio"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
            {portfolio.profile.bio}
          </p>
        </section>

        {/* Dynamic Sections */}
        {portfolio.sections.map((section) => (
          <section key={section.id} className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif font-bold text-gray-800 border-l-4 border-pink-400 pl-4">
                {section.title}
              </h2>
              {isLoggedIn && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingPost(null);
                      setNewPostTitle('');
                      setNewPostContent('');
                      setNewPostMedia([]);
                      setActivePostModal(section.id);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-pink-500 hover:bg-pink-50 border border-pink-200 rounded-lg transition-all font-medium shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Post
                  </button>
                  <button
                    onClick={() => setReorderPostsSectionId(section.id)}
                    className="flex items-center gap-2 px-3 py-2 bg-white text-pink-500 hover:bg-pink-50 border border-pink-200 rounded-lg transition-all font-medium shadow-sm"
                  >
                    <GripVertical className="w-4 h-4" /> Rearrange Posts
                  </button>
                  <button
                    onClick={() => deleteAllPostsInSection(section.id)}
                    className="flex items-center gap-2 px-3 py-2 bg-white text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-all font-medium shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Clear Posts
                  </button>
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="p-2 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {section.title.trim().toLowerCase() === RESUME_SECTION_TITLE.toLowerCase() ? (
              <div className="space-y-3">
                {section.posts.filter((post) => post.media.some((media) => media.type === 'pdf')).length === 0 ? (
                  <div className="py-8 text-center bg-pink-50/50 rounded-2xl border-2 border-dashed border-pink-100">
                    <p className="text-pink-300 italic">No resume uploaded yet.</p>
                  </div>
                ) : (
                  section.posts.map((post) => {
                    const pdfMedia = post.media.find((media) => media.type === 'pdf');
                    if (!pdfMedia) return null;

                    return (
                      <a
                        key={post.id}
                        href={pdfMedia.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 w-fit px-4 py-3 bg-white text-pink-600 hover:bg-pink-50 border border-pink-200 rounded-xl transition-all font-semibold shadow-sm"
                      >
                        <FileText className="w-4 h-4" />
                        <span>{post.content || pdfMedia.name || 'Resume'}</span>
                      </a>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-x-auto pb-4 scrollbar-thin">
                {section.posts.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-pink-50/50 rounded-2xl border-2 border-dashed border-pink-100">
                    <p className="text-pink-300 italic">No posts here yet.</p>
                  </div>
                ) : (
                  section.posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => setExpandedPost({ post, sectionTitle: section.title })}
                      className="group relative bg-white/95 rounded-2xl shadow-lg border border-pink-50 overflow-hidden flex flex-col hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                    >
                      {isLoggedIn && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPost({post, sectionId: section.id});
                            }}
                            className="absolute top-2 right-12 z-10 p-1.5 bg-blue-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePost(section.id, post.id);
                            }}
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      
                      {post.media.length > 0 && (
                        <div className="relative aspect-video bg-gray-100 overflow-hidden">
                          {post.media[0].type === 'image' && (
                            <img src={post.media[0].url} alt="Media" className="w-full h-full object-cover" />
                          )}
                          {post.media[0].type === 'video' && (
                            <video src={post.media[0].url} className="w-full h-full object-cover" controls />
                          )}
                          {post.media[0].type === 'pdf' && renderPdfPreview(post.media[0], true)}
                          {post.media.length > 1 && (
                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded-md backdrop-blur-sm">
                              +{post.media.length - 1} more
                            </div>
                          )}
                        </div>
                      )}

                      <div className="p-4 flex-grow">
                        {post.title && (
                          <h3
                            className="text-base font-bold text-gray-800 leading-snug mb-2 line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: getFormattedHtml(post.title) }}
                          />
                        )}
                        <div
                          className="text-gray-700 text-sm whitespace-pre-wrap line-clamp-4 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: getFormattedHtml(post.content) }}
                        />
                      </div>
                      
                      <div className="px-4 py-2 bg-pink-50/50 text-[10px] text-pink-300 font-semibold tracking-wider uppercase">
                        {new Date(post.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        ))}
      </main>

      <button
        onClick={() => setShowFeedbackModal(true)}
        className="fixed bottom-6 right-6 z-[95] px-5 py-3 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-full shadow-xl shadow-pink-200 transition-all"
      >
        Leave your thoughts
      </button>

      {/* MODALS */}
      
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl border border-pink-100 animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-8">
              <div className="inline-flex p-3 bg-pink-50 rounded-full mb-4">
                <Lock className="w-8 h-8 text-pink-500" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-gray-800 mb-2">Owner Access</h1>
              <p className="text-gray-500 text-sm">Enter your secret code to manage your portfolio</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 w-5 h-5" />
                <input
                  type="password"
                  placeholder="Access Code"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-pink-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-pink-200"
              >
                Unlock Dashboard
              </button>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="w-full py-2 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl p-8 shadow-2xl">
            <h3 className="text-2xl font-serif font-bold text-gray-800 mb-6">Update Profile</h3>
            <form onSubmit={handleProfileUpdate} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                <input name="name" defaultValue={portfolio.profile.name} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                <input name="email" defaultValue={portfolio.profile.email} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">LinkedIn</label>
                <input name="linkedin" defaultValue={portfolio.profile.linkedin} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Instagram</label>
                <input name="instagram" defaultValue={portfolio.profile.instagram} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Education / Degree</label>
                <input name="degree" defaultValue={portfolio.profile.degreeDetails} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">College</label>
                <input name="college" defaultValue={portfolio.profile.college} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bio</label>
                <textarea name="bio" defaultValue={portfolio.profile.bio} className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300 outline-none min-h-[100px] resize-none" />
              </div>
              <div className="col-span-2 flex gap-3 mt-4">
                <button type="submit" className="flex-grow py-3 bg-pink-500 text-white font-bold rounded-xl shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all">Save Profile</button>
                <button type="button" onClick={() => setIsEditingProfile(false)} className="px-6 py-3 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create New Section</h3>
            <input
              type="text"
              placeholder="e.g. Work Experience, Awards"
              className="w-full px-4 py-3 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200 mb-4"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={addSection} className="flex-grow py-3 bg-pink-500 text-white font-bold rounded-xl shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all">Create</button>
              <button onClick={() => setShowSectionModal(false)} className="px-6 py-3 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal (Public) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-pink-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">Leave your thoughts</h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                className="p-2 text-gray-400 hover:text-pink-500 hover:bg-pink-50 rounded-lg transition-all"
                aria-label="Close feedback modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitFeedback} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  required
                  value={feedbackForm.name}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full mt-1 px-4 py-2 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  required
                  value={feedbackForm.email}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full mt-1 px-4 py-2 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Thoughts</label>
                <textarea
                  required
                  value={feedbackForm.thoughts}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, thoughts: e.target.value }))}
                  className="w-full mt-1 px-4 py-2 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200 min-h-[120px] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingFeedback}
                  className="flex-grow py-3 bg-pink-500 text-white font-bold rounded-xl shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all disabled:opacity-60"
                >
                  {isSubmittingFeedback ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-6 py-3 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Modal (Admin Only) */}
      {isLoggedIn && showAdminFeedbackModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl p-6 shadow-2xl border border-pink-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">User Feedback</h3>
              <button
                onClick={() => setShowAdminFeedbackModal(false)}
                className="p-2 text-gray-400 hover:text-pink-500 hover:bg-pink-50 rounded-lg transition-all"
                aria-label="Close admin feedback modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {feedbackItems.length === 0 ? (
              <div className="py-10 text-center bg-pink-50/40 border border-dashed border-pink-100 rounded-xl">
                <p className="text-pink-300 italic">No feedback yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbackItems.map((item) => (
                  <div key={item.id} className="p-4 border border-pink-100 rounded-xl bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : 'Just now'}
                      </p>
                    </div>
                    <p className="text-xs text-pink-500 mt-1">{item.email}</p>
                    <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap leading-relaxed">{item.thoughts}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reorder Sections Modal */}
      {showReorderModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-800">Rearrange Sections</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">Drag and drop items to change the section order.</p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {portfolio.sections.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center border border-dashed rounded-xl">No sections to rearrange.</p>
              ) : (
                portfolio.sections.map((section) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => setDraggingSectionId(section.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggingSectionId) {
                        reorderSections(draggingSectionId, section.id);
                      }
                      setDraggingSectionId(null);
                    }}
                    onDragEnd={() => setDraggingSectionId(null)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-move ${
                      draggingSectionId === section.id
                        ? 'bg-pink-50 border-pink-300'
                        : 'bg-white border-pink-100 hover:bg-pink-50/50'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-pink-400" />
                    <span className="text-sm font-medium text-gray-700">{section.title}</span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowReorderModal(false)}
                className="px-6 py-2 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Post Modal */}
      {activePostModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">{editingPost ? 'Edit Post' : `Add to ${portfolio.sections.find(s => s.id === activePostModal)?.title}`}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Post Title</label>
                <input
                  ref={postTitleInputRef}
                  type="text"
                  placeholder="Add a title for this post"
                  className="w-full mt-1 px-4 py-2 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => applyFormat('title', '**')}
                    className="px-3 py-1.5 text-sm border border-pink-200 rounded-lg hover:bg-pink-50 font-bold"
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormat('title', '*')}
                    className="px-3 py-1.5 text-sm border border-pink-200 rounded-lg hover:bg-pink-50 italic"
                    title="Italic"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormat('title', '__')}
                    className="px-3 py-1.5 text-sm border border-pink-200 rounded-lg hover:bg-pink-50 underline"
                    title="Underline"
                  >
                    U
                  </button>
                </div>
              </div>

              <textarea
                ref={postContentInputRef}
                placeholder="What would you like to share?"
                className="w-full p-4 border border-pink-50 bg-pink-50/20 rounded-xl outline-none focus:ring-2 focus:ring-pink-100 min-h-[150px] resize-none"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
              />
              <div className="flex items-center gap-2 -mt-2">
                <button
                  type="button"
                  onClick={() => applyFormat('content', '**')}
                  className="px-3 py-1.5 text-sm border border-pink-200 rounded-lg hover:bg-pink-50 font-bold"
                  title="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('content', '*')}
                  className="px-3 py-1.5 text-sm border border-pink-200 rounded-lg hover:bg-pink-50 italic"
                  title="Italic"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat('content', '__')}
                  className="px-3 py-1.5 text-sm border border-pink-200 rounded-lg hover:bg-pink-50 underline"
                  title="Underline"
                >
                  U
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {newPostMedia.map((media) => (
                  <div key={media.id} className="relative group aspect-square bg-gray-50 rounded-lg overflow-hidden border">
                    {media.type === 'image' && <img src={media.url} className="w-full h-full object-cover" />}
                    {media.type === 'video' && <video src={media.url} className="w-full h-full object-cover" />}
                    {media.type === 'pdf' && (
                      <div className="flex items-center justify-center h-full text-pink-400">
                        <FileText className="w-8 h-8" />
                      </div>
                    )}
                    <button
                      onClick={() => setNewPostMedia(prev => prev.filter(m => m.id !== media.id))}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-pink-100 rounded-lg text-pink-300">
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-semibold uppercase text-center px-2">Add Link</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input
                  type="url"
                  placeholder="Paste image / video / PDF link"
                  className="md:col-span-3 w-full px-4 py-2 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200"
                  value={newMediaUrl}
                  onChange={(e) => setNewMediaUrl(e.target.value)}
                />
                <select
                  className="md:col-span-1 w-full px-3 py-2 border border-pink-100 rounded-xl bg-white outline-none focus:ring-2 focus:ring-pink-200"
                  value={newMediaType}
                  onChange={(e) => setNewMediaType(e.target.value as 'image' | 'video' | 'pdf')}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="pdf">PDF</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddMediaLink}
                  className="md:col-span-1 px-4 py-2 bg-pink-500 text-white rounded-xl font-semibold hover:bg-pink-600 transition-all"
                >
                  Add Link
                </button>
              </div>

              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Upload File</label>
                <input
                  type="file"
                  accept="image/*,video/*,.pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const url = await uploadFile(file);
                        let type: 'image' | 'video' | 'pdf';
                        if (file.type.startsWith('image/')) type = 'image';
                        else if (file.type.startsWith('video/')) type = 'video';
                        else if (file.type === 'application/pdf') type = 'pdf';
                        else {
                          alert('Unsupported file type. Please select an image, video, or PDF.');
                          return;
                        }
                        const name = file.name;
                        const newItem: MediaItem = {
                          id: Math.random().toString(36).substr(2, 9),
                          type,
                          url,
                          name,
                        };
                        setNewPostMedia((prev) => [...prev, newItem]);
                        e.target.value = ''; // reset
                      } catch (err) {
                        console.error('Upload failed:', err);
                        alert('Upload failed. Please try again.');
                      }
                    }
                  }}
                  className="w-full px-4 py-2 border border-pink-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200"
                />
              </div>

              <div className="flex items-center gap-4 text-xs text-pink-400 border-t pt-4">
                <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Images</span>
                <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Videos</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDFs</span>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => editingPost ? updatePost(editingPost.sectionId, editingPost.post.id) : createPost(activePostModal!)} 
                disabled={!newPostTitle && !newPostContent && newPostMedia.length === 0}
                className="flex-grow py-3 bg-pink-500 text-white font-bold rounded-xl shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all disabled:opacity-50"
              >
                {editingPost ? 'Update Post' : 'Post Content'}
              </button>
              <button onClick={() => { setActivePostModal(null); setEditingPost(null); setNewPostTitle(''); setNewPostMedia([]); setNewPostContent(''); }} className="px-6 py-3 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Posts Modal */}
      {reorderPostsSectionId && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-800">Rearrange Posts</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              {portfolio.sections.find((s) => s.id === reorderPostsSectionId)?.title}
            </p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {(portfolio.sections.find((s) => s.id === reorderPostsSectionId)?.posts ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center border border-dashed rounded-xl">No posts to rearrange.</p>
              ) : (
                (portfolio.sections.find((s) => s.id === reorderPostsSectionId)?.posts ?? []).map((post) => (
                  <div
                    key={post.id}
                    draggable
                    onDragStart={() => setDraggingPostId(post.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggingPostId) {
                        reorderPosts(reorderPostsSectionId, draggingPostId, post.id);
                      }
                      setDraggingPostId(null);
                    }}
                    onDragEnd={() => setDraggingPostId(null)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-move ${
                      draggingPostId === post.id
                        ? 'bg-pink-50 border-pink-300'
                        : 'bg-white border-pink-100 hover:bg-pink-50/50'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-pink-400 mt-0.5" />
                    <div className="min-w-0">
                      {post.title && (
                        <p className="text-sm font-semibold text-gray-800 truncate">{post.title}</p>
                      )}
                      <p className="text-xs text-gray-500 truncate">
                        {post.content || (post.media.length > 0 ? `${post.media.length} media item(s)` : 'Untitled post')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setReorderPostsSectionId(null)}
                className="px-6 py-2 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Post Modal */}
      {expandedPost && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setExpandedPost(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-pink-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-5 bg-white/95 backdrop-blur border-b border-pink-100">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-pink-500">{expandedPost.sectionTitle}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(expandedPost.post.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setExpandedPost(null)}
                className="p-2 text-gray-400 hover:text-pink-500 hover:bg-pink-50 rounded-lg transition-all"
                aria-label="Close expanded post"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {expandedPost.post.media.map((media) => (
                <div key={media.id} className="rounded-xl overflow-hidden border border-pink-100 bg-pink-50/20">
                  {media.type === 'image' && (
                    <img src={media.url} alt={media.name || 'Post image'} className="w-full max-h-[420px] object-contain bg-white" />
                  )}
                  {media.type === 'video' && (
                    <video src={media.url} className="w-full max-h-[420px] bg-black" controls />
                  )}
                  {media.type === 'pdf' && renderPdfPreview(media)}
                </div>
              ))}

              {expandedPost.post.title && (
                <h3
                  className="text-xl font-bold text-gray-800 leading-snug"
                  dangerouslySetInnerHTML={{ __html: getFormattedHtml(expandedPost.post.title) }}
                />
              )}
              <div
                className="text-gray-700 whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: getFormattedHtml(expandedPost.post.content) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
