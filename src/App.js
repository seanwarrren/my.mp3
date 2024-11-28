import React, { useEffect, useState } from "react";
import "./App.css";

const CLIENT_ID = "13e244917ca64efb96556f753fcd032b";
const CLIENT_SECRET = "ded93049447347769bcea9b2327c7ba6";
const LAST_FM_API_KEY = "6c1ef5f762d5edfeaf1023d54afaa832";

function App() {
  const [accessToken, setAccessToken] = useState("");
  const [song, setSong] = useState(() => localStorage.getItem("song") || "");
  const [artist, setArtist] = useState(() => localStorage.getItem("artist") || "");
  const [isGenerated, setIsGenerated] = useState(() => {
    const storedIsGenerated = localStorage.getItem("isGenerated");
    return storedIsGenerated ? storedIsGenerated === "true" : "false";
  });
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recommendedTracks, setRecommendedTracks] = useState(() => {
    const storedTracks = localStorage.getItem("recommendedTracks");
    return storedTracks ? JSON.parse(storedTracks) : [];
  });
  const [message, setMessage] = useState("");
  const [resultLoading, setResultLoading] = useState(false);

  useEffect(() => {
    if (isGenerated) {
      setResultLoading(true);
      const timer = setTimeout(() => {
        setResultLoading(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isGenerated]);

  useEffect(() => {
    localStorage.setItem("song", song);
  }, [song]);

  useEffect(() => {
    localStorage.setItem("artist", artist);
  }, [artist]);

  useEffect(() => {
    localStorage.setItem("isGenerated", isGenerated);
  }, [isGenerated]);

  useEffect(() => {
    localStorage.setItem("recommendedTracks", JSON.stringify(recommendedTracks));
  }, [recommendedTracks]);


  // get token upon app start

  useEffect(() => {
    const fetchToken = async () => {
      const authParameters = {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      };

      try {
        const response = await fetch("https://accounts.spotify.com/api/token", authParameters);
        const data = await response.json();
        setAccessToken(data.access_token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };

    fetchToken();
  }, []);

  
  // get suggestions for autofill

  const fetchSuggestions = async (query) => {
    if (!query || !accessToken) return;
    setLoading(true);

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();
      const tracks = data.tracks.items.map((track) => ({
        title: track.name,
        artist: track.artists[0].name,
      }));

      setOptions(tracks);
    } catch (error) {
        console.error("Error fetching suggestions:", error);
    } finally {
        setLoading(false);
    }
  };


  // get similar tracks from lastfm

  const getSimilarTracks = async (song, artist) => {
    try {
      const response = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(
          artist
        )}&track=${encodeURIComponent(song)}&limit=30&api_key=${LAST_FM_API_KEY}&format=json`
      );
      const data = await response.json();
      if (!data.similartracks || !data.similartracks.track) {
        return [];
      }
      return data.similartracks.track.map((track) => ({
        name: track.name,
        artist: track.artist.name,
      }));
    } catch (error) {
      console.error("Error fetching similar tracks from Last.fm:", error);
      return [];
    }
  };


  // search for tracks on spotify by name and artist

  const searchSpotifyTracks = async (tracks) => {
    const results = await Promise.all(
      tracks.map(async (track) => {
        try {
          const response = await fetch(
            `https://api.spotify.com/v1/search?q=track:${encodeURIComponent(
              track.name
            )}%20artist:${encodeURIComponent(track.artist)}&type=track&limit=1`,
            {
              headers: { Authorization: `Bearer ${accessToken}`},
            }
          );
          const data = await response.json();
          return data.tracks.items[0] || null;
        } catch (error) {
          console.error("Error searching spotify tracks:", error);
          return null;
        }
      })
    );
    return results.filter((track) => track !== null);
  };


  // handle song generation

  const handleGenerate = async () => {
    if (!song || !artist) {
      setMessage("Please enter a song and artist.");
      return;
    }
  
    setLoading(true);
    setMessage(""); 
    setRecommendedTracks([]); 
    localStorage.removeItem("recommendedTracks"); 
    setIsGenerated(false);
  
    try {
      const similarTracks = await getSimilarTracks(song, artist);
      if (similarTracks.length === 0) {
        setMessage("No similar tracks were found.");
        return;
      }
  
      const spotifyTracks = await searchSpotifyTracks(similarTracks);
      if (spotifyTracks.length === 0) {
        setMessage("No Spotify tracks were found for similar songs.");
        return;
      }
  
      setAndStoreRecommendedTracks(spotifyTracks);
      setIsGenerated(true); 
      console.log("Generated similar tracks:", spotifyTracks);
    } catch (error) {
        console.error("Error generating similar tracks.", error);
        setMessage("An error occurred while generating similar tracks. Please try again.");
    } finally {
        setLoading(false);
    }
  };

 
  // helper function to set and store recommended tracks

  const setAndStoreRecommendedTracks = (tracks) => {
    console.log("Storing recommendedTracks in localStorage:", tracks);
    setRecommendedTracks(tracks);
    localStorage.setItem("recommendedTracks", JSON.stringify(tracks));
  };


  // clear fields and go back to start page to enter new song

  const handleEnterNewSong = () => {
    setIsGenerated(false);
    setSong("");
    setArtist("");
    setOptions([]);
    localStorage.removeItem("song");
    localStorage.removeItem("artist");
    localStorage.removeItem("recommendedTracks");
    localStorage.setItem("isGenerated", false);
  };

  return (
    <div className="app-container">
      {!isGenerated ? (
        <div className="input-page">
          <div className="header">
            <div className="header-content">
              <div className="header-text">
                <h1>Welcome to—</h1>
                <h2>MY.MP3</h2>
                <p>
                  Enter a song and artist to generate a playlist of similar tracks.
                </p>
              </div>
            </div>
          </div>
          <div className="form-container">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter Song Title"
                value={song}
                onChange={(e) => {
                  setSong(e.target.value);
                  if (e.target.value.length > 1) {
                    fetchSuggestions(e.target.value);
                  } else {
                    setOptions([]);
                  }
                }}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Enter Artist Name"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="input-field"
              />
            </div>
            {message && <div className="message">{message}</div>}
            <ul className="suggestions-list">
              {loading ? (
                <li className="loading">Loading...</li>
              ) : (
                options.map((option, index) => (
                  <li
                    key={index}
                    onClick={() => {
                      setSong(option.title);
                      setArtist(option.artist);
                      setOptions([]);
                    }}
                    className="suggestion-item"
                  >
                    {option.title} - {option.artist}
                  </li>
                ))
              )}
            </ul>
            <button onClick={handleGenerate} className="generate-button">
              Generate Similar Songs
            </button>
            <h4 className="creator-link">
              Created by{' '}
              <a
                href="https://www.linkedin.com/in/sean--warren"
                target="_blank"
                rel="noopener norefferer"
                className="linkedin-link"
              >
                Sean Warren
              </a>
            </h4>
          </div>
        </div>
      ) : (
        <div className="result-page">
          {resultLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <>
              <h2>MY.MP3</h2>
              <h3>
                Similar songs for <strong>{song}</strong> by <strong>{artist}</strong>
              </h3>
              <h4>
                Click a song to listen on Spotify.
              </h4>
              <div className="recommended-tracks">
                {recommendedTracks.map((track, index) => (
                  <div 
                    key={track.id} 
                    className="song-item"
                    style={{
                      animationDelay: `${index * 0.1}s`,
                    }}
                  >
                    <div className="song-content">
                      <div className="album-art-container">
                      <img
                        src={track.album.images[2]?.url || track.album.images[0]?.url}
                        alt={`${track.name} album art`}
                        className="album-art"
                      />
                      </div>
                      <div className="song-info">
                        <a
                          href={track.external_urls.spotify}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="song-title-link"
                        >
                          {track.name}
                        </a>
                        <span className="song-artists">
                          by {track.artists.map((artist) => artist.name).join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="buttons-container">
                <button onClick={handleEnterNewSong} className="back-button">
                  Enter a new song
                </button>
              </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;