
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Lock, Plus, LogOut, User, Mail, Linkedin, Instagram, GraduationCap, Trash2, Edit2, Upload, FileText, Video, ImageIcon, LogIn, ShieldCheck } from 'lucide-react';
import SakuraBackground from './components/SakuraBackground';
import { PortfolioData, Section, Post, MediaItem, ProfileData } from './types';
import profilePic from './profile.jpg';
import { db, storage } from './firebase';

const FIXED_DEGREE = 'Bachelor of Engineering in Computer Engineering';
const DEFAULT_BIO = 'I am a Computer Engineering student with a passion for building clean, user-friendly digital experiences.';
const DEFAULT_COLLEGE = 'SCOE';
const PORTFOLIO_DOC_ID = 'portfoliokajol';

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
      id: 'default-1',
      title: 'Certificates',
      posts: [],
    },
    {
      id: 'default-2',
      title: 'Skills',
      posts: [],
    }
  ]
};

const SECRET_CODE = "DAZAI4teru";

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [portfolio, setPortfolio] = useState<PortfolioData>(INITIAL_DATA);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [activePostModal, setActivePostModal] = useState<string | null>(null); // sectionId
  
  // Post creation state
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState<MediaItem[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const normalizePortfolio = (data: PortfolioData): PortfolioData => ({
    ...data,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingMedia(true);
    const uploads = Array.from(files).map(async (file: File) => {
      let type: 'image' | 'video' | 'pdf' = 'image';
      if (file.type.includes('video')) type = 'video';
      if (file.type.includes('pdf')) type = 'pdf';

      const id = Math.random().toString(36).substr(2, 9);
      const safeName = file.name.replace(/\s+/g, '_');
      const path = `media/${PORTFOLIO_DOC_ID}/${Date.now()}-${id}-${safeName}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const newItem: MediaItem = {
        id,
        type,
        url,
        name: file.name,
      };
      return newItem;
    });

    try {
      const uploaded = await Promise.all(uploads);
      setNewPostMedia((prev) => [...prev, ...uploaded]);
    } catch (err) {
      console.error('Failed to upload media', err);
      alert('Failed to upload one or more files. Please try again.');
    } finally {
      setIsUploadingMedia(false);
      e.target.value = '';
    }
  };

  const createPost = (sectionId: string) => {
    const newPost: Post = {
      id: Date.now().toString(),
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
    setNewPostContent('');
    setNewPostMedia([]);
    setActivePostModal(null);
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
                    onClick={() => setActivePostModal(section.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-pink-500 hover:bg-pink-50 border border-pink-200 rounded-lg transition-all font-medium shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Post
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-x-auto pb-4 scrollbar-thin">
              {section.posts.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-pink-50/50 rounded-2xl border-2 border-dashed border-pink-100">
                  <p className="text-pink-300 italic">No posts here yet.</p>
                </div>
              ) : (
                section.posts.map((post) => (
                  <div key={post.id} className="group relative bg-white/95 rounded-2xl shadow-lg border border-pink-50 overflow-hidden flex flex-col hover:scale-[1.02] transition-transform duration-300">
                    {isLoggedIn && (
                      <button
                        onClick={() => deletePost(section.id, post.id)}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    
                    {post.media.length > 0 && (
                      <div className="relative aspect-video bg-gray-100 overflow-hidden">
                        {post.media[0].type === 'image' && (
                          <img src={post.media[0].url} alt="Media" className="w-full h-full object-cover" />
                        )}
                        {post.media[0].type === 'video' && (
                          <video src={post.media[0].url} className="w-full h-full object-cover" controls />
                        )}
                        {post.media[0].type === 'pdf' && (
                          <div className="flex flex-col items-center justify-center h-full text-pink-400">
                            <FileText className="w-12 h-12" />
                            <span className="text-xs mt-2 px-2 text-center truncate w-full">{post.media[0].name}</span>
                          </div>
                        )}
                        {post.media.length > 1 && (
                          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded-md backdrop-blur-sm">
                            +{post.media.length - 1} more
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-4 flex-grow">
                      <p className="text-gray-700 text-sm whitespace-pre-wrap line-clamp-4 leading-relaxed">
                        {post.content}
                      </p>
                    </div>
                    
                    <div className="px-4 py-2 bg-pink-50/50 text-[10px] text-pink-300 font-semibold tracking-wider uppercase">
                      {new Date(post.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </main>

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

      {/* Add Post Modal */}
      {activePostModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add to {portfolio.sections.find(s => s.id === activePostModal)?.title}</h3>
            
            <div className="space-y-4">
              <textarea
                placeholder="What would you like to share?"
                className="w-full p-4 border border-pink-50 bg-pink-50/20 rounded-xl outline-none focus:ring-2 focus:ring-pink-100 min-h-[150px] resize-none"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
              />

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
                <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-pink-100 rounded-lg hover:bg-pink-50 cursor-pointer transition-colors text-pink-300">
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-semibold uppercase">Add Media</span>
                  <input type="file" multiple className="hidden" accept="image/*,video/*,.pdf" onChange={handleFileUpload} />
                </label>
              </div>

              <div className="flex items-center gap-4 text-xs text-pink-400 border-t pt-4">
                <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Images</span>
                <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Video</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDFs</span>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => createPost(activePostModal!)} 
                disabled={(!newPostContent && newPostMedia.length === 0) || isUploadingMedia}
                className="flex-grow py-3 bg-pink-500 text-white font-bold rounded-xl shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all disabled:opacity-50"
              >
                {isUploadingMedia ? 'Uploading...' : 'Post Content'}
              </button>
              <button onClick={() => { setActivePostModal(null); setNewPostMedia([]); setNewPostContent(''); }} className="px-6 py-3 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
