import { Spinner } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import tmdbService from '../services/tmdbService';

function Trailer({ movieID: propMovieID }) {
  const location = useLocation();
  const queryMovieID = new URLSearchParams(location.search).get('movieID');
  const movieID = propMovieID || queryMovieID;

  const [videos, setVideos] = useState(null);
  const [trailerKey, setTrailerKey] = useState(null);

  useEffect(() => {
    if (!movieID) return undefined;
    let active = true;

    tmdbService
      .getMovieVideos(movieID)
      .then((results) => {
        if (!active) return;
        setVideos(results);
        const found = results.find((v) => v.type === 'Trailer') || results[0];
        setTrailerKey(found ? found.key : null);
      })
      .catch((error) => {
        console.error('Hay un error cargando el trailer:', error);
        if (active) setVideos([]);
      });

    return () => {
      active = false;
    };
  }, [movieID]);

  return (
    <div className="mt-3">
      {!videos && (
        <div>
          <Spinner
            thickness="4px"
            speed="0.65s"
            emptyColor="gray.200"
            color="red.500"
            size="xl"
          />
          <h2>Cargando video...</h2>
        </div>
      )}
      {trailerKey && (
        <div className="ratio ratio-16x9 mb-3">
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}`}
            title="Trailer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

export default Trailer;
