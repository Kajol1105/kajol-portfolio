
export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'pdf';
  url: string;
  name: string;
}

export interface Post {
  id: string;
  title?: string;
  content: string;
  media: MediaItem[];
  timestamp: number;
}

export interface Section {
  id: string;
  title: string;
  posts: Post[];
}

export interface ProfileData {
  name: string;
  email: string;
  linkedin: string;
  instagram: string;
  degreeDetails: string;
  profilePicture: string;
  bio: string;
  college: string;
}

export interface PortfolioData {
  profile: ProfileData;
  sections: Section[];
}
