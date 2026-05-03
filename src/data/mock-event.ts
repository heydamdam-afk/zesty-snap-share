import cover from "@/assets/event-cover.jpg";
import p1 from "@/assets/photo-1.jpg";
import p2 from "@/assets/photo-2.jpg";
import p3 from "@/assets/photo-3.jpg";
import p4 from "@/assets/photo-4.jpg";
import p5 from "@/assets/photo-5.jpg";
import p6 from "@/assets/photo-6.jpg";

export type Comment = {
  id: string;
  author: string;
  initials: string;
  text: string;
  date: string;
};

export type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  author: string;
  initials: string;
  date: string;
  caption?: string;
  likes: number;
  liked?: boolean;
  comments: Comment[];
};

export const event = {
  title: "Mariage de Sabrina & Thomas",
  host: "Michelle Lapelouse",
  hostInitials: "ML",
  date: "31 Décembre 2025",
  location: "Château de la Roche-Guyon, 95780",
  cover,
  guests: { invited: 124, coming: 86, maybe: 12 },
  description:
    "Le plus beau jour de notre vie partagé avec vous tous. Postez vos photos, vos vidéos et vos plus beaux moments — on garde tout pour l'éternité.",
  countdown: "31 DÉC",
};

export const photos: Photo[] = [
  {
    id: "1",
    src: p2,
    width: 800,
    height: 1000,
    author: "Carlota Monteiro",
    initials: "CM",
    date: "Il y a 2 h",
    caption: "Le moment le plus magique de la journée 💍✨",
    likes: 89,
    liked: true,
    comments: [
      { id: "c1", author: "Cody Fisher", initials: "CF", text: "Tellement beau ! Félicitations à vous deux 🥰", date: "1 h" },
      { id: "c2", author: "Jane Cooper", initials: "JC", text: "Je pleure 😭❤️", date: "45 min" },
    ],
  },
  {
    id: "2",
    src: p1,
    width: 800,
    height: 800,
    author: "Damien Breteau",
    initials: "DB",
    date: "Il y a 3 h",
    caption: "La déco était à tomber 🌹",
    likes: 64,
    comments: [
      { id: "c3", author: "Marie L.", initials: "MA", text: "Magnifique table !", date: "2 h" },
    ],
  },
  {
    id: "3",
    src: p3,
    width: 800,
    height: 600,
    author: "Léo Martin",
    initials: "LM",
    date: "Il y a 4 h",
    caption: "Aux mariés ! 🥂",
    likes: 132,
    liked: true,
    comments: [],
  },
  {
    id: "4",
    src: p4,
    width: 800,
    height: 900,
    author: "Emma Rousseau",
    initials: "ER",
    date: "Il y a 5 h",
    caption: "Cette piste de danse 🔥💃",
    likes: 201,
    comments: [
      { id: "c4", author: "Tom B.", initials: "TB", text: "On a tout cassé !", date: "3 h" },
    ],
  },
  {
    id: "5",
    src: p5,
    width: 800,
    height: 800,
    author: "Sabrina M.",
    initials: "SM",
    date: "Il y a 6 h",
    caption: "Mon bouquet 💐",
    likes: 178,
    liked: true,
    comments: [],
  },
  {
    id: "6",
    src: p6,
    width: 800,
    height: 1100,
    author: "Julien Petit",
    initials: "JP",
    date: "Il y a 7 h",
    caption: "La sortie aux étincelles ✨🎇",
    likes: 245,
    comments: [
      { id: "c5", author: "Carlota M.", initials: "CM", text: "Cette photo !! 😍", date: "5 h" },
      { id: "c6", author: "Cody F.", initials: "CF", text: "Iconique", date: "4 h" },
    ],
  },
];