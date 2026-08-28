import { useEffect, useState } from "react";
import PostForm from "./PostForm.jsx";
import { fetchPosts, deletePost } from "../api/posts.js";

export default function PostList({ user }) {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPosts()
      .then(setPosts)
      .catch((err) => setError(err.message));
  }, []);

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este post?")) return;
    try {
      await deletePost(id);
      setPosts(posts.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      {error && <p className="text-red-400">{error}</p>}
      {user && <PostForm onCreated={(post) => setPosts([post, ...posts])} />}

      {posts.length === 0 ? (
        <p className="text-center text-slate-400">No hay posts todavía.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.id} className="bg-slate-900 rounded-2xl p-5">
              <h3 className="text-lg font-bold">{post.title}</h3>
              <p className="text-slate-300 mt-1">{post.body}</p>
              <div className="flex justify-between items-center mt-3 text-sm text-slate-400">
                <span>
                  {post.username ? `por @${post.username}` : "autor anónimo"}
                </span>
                <span>{new Date(post.created_at).toLocaleString()}</span>
              </div>
              {user && (post.user_id === user.id || user.isAdmin) && (
                <button
                  onClick={() => handleDelete(post.id)}
                  className="mt-3 text-red-400 hover:text-red-300"
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
