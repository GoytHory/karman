package ru.karman.app.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface Api {
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginBody): AuthResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: LoginBody): AuthResponse

    @GET("api/videos")
    suspend fun videos(
        @Query("scope") scope: String = "all",
        @Query("q") q: String? = null,
        @Query("playlist_id") playlistId: Int? = null,
        @Query("status") status: String? = null,
        @Query("limit") limit: Int = 100,
        @Query("offset") offset: Int = 0,
    ): VideoList

    @GET("api/videos/{id}")
    suspend fun video(@Path("id") id: Int): Video

    @GET("api/videos/{id}/playback")
    suspend fun playback(@Path("id") id: Int): PlaybackInfo

    @POST("api/videos/{id}/reaction")
    suspend fun reaction(@Path("id") id: Int, @Body body: ReactionBody): Video

    @POST("api/videos/{id}/progress")
    suspend fun progress(@Path("id") id: Int, @Body body: ProgressBody): ProgressResponse

    @POST("api/videos/{id}/retry")
    suspend fun retry(@Path("id") id: Int): Video

    @GET("api/playlists")
    suspend fun playlists(@Query("scope") scope: String = "all"): List<Playlist>

    @GET("api/history")
    suspend fun history(@Query("limit") limit: Int = 100, @Query("offset") offset: Int = 0): HistoryList

    @GET("api/status")
    suspend fun status(): StatusResponse
}
