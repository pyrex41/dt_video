port module MediaLibrary exposing (Model, Msg, Clip, init, update, view)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import Json.Decode as Decode
import Json.Encode as Encode


-- MODEL


type alias Model =
    { isCollapsed : Bool
    , searchQuery : String
    , expandedClipId : Maybe String
    , deleteConfirmId : Maybe String
    }


type alias Clip =
    { id : String
    , path : String
    , fileName : String
    , duration : Float
    , resolution : String
    , file_size : Maybe Int
    , codec : Maybe String
    , fps : Maybe Float
    , bit_rate : Maybe Int
    , thumbnail_path : Maybe String
    }


init : Model
init =
    { isCollapsed = False
    , searchQuery = ""
    , expandedClipId = Nothing
    , deleteConfirmId = Nothing
    }


-- UPDATE


type Msg
    = ToggleSidebar
    | SearchInput String
    | ExpandClip String
    | CollapseClip
    | ConfirmDelete String
    | CancelDelete
    | DeleteConfirmed String
    | DragStart Clip


update : Msg -> Model -> ( Model, Maybe String )
update msg model =
    case msg of
        ToggleSidebar ->
            ( { model | isCollapsed = not model.isCollapsed }, Nothing )

        SearchInput query ->
            ( { model | searchQuery = query }, Nothing )

        ExpandClip clipId ->
            ( { model | expandedClipId = Just clipId }, Nothing )

        CollapseClip ->
            ( { model | expandedClipId = Nothing }, Nothing )

        ConfirmDelete clipId ->
            ( { model | deleteConfirmId = Just clipId }, Nothing )

        CancelDelete ->
            ( { model | deleteConfirmId = Nothing }, Nothing )

        DeleteConfirmed clipId ->
            ( { model | deleteConfirmId = Nothing }, Just clipId )

        DragStart _ ->
            ( model, Nothing )


-- VIEW


view : List Clip -> Model -> Html Msg
view clips model =
    div
        [ class "bg-gray-800 border-l border-gray-700 flex flex-col transition-all duration-300"
        , style "width" (if model.isCollapsed then "48px" else "320px")
        ]
        [ -- Header
          div [ class "p-4 border-b border-gray-700 flex items-center justify-between" ]
              [ h3 [ class "text-sm font-semibold text-gray-300" ] [ text "Media Library" ]
              , button
                  [ onClick ToggleSidebar
                  , class "text-gray-400 hover:text-white transition-colors"
                  ]
                  [ text (if model.isCollapsed then "▶" else "◀") ]
              ]
        , if model.isCollapsed then
            text ""
          else
            div [ class "flex-1 overflow-y-auto" ]
                [ -- Search bar
                  div [ class "p-4 border-b border-gray-700" ]
                      [ div [ class "relative" ]
                          [ input
                              [ type_ "text"
                              , placeholder "Search by name, codec..."
                              , value model.searchQuery
                              , onInput SearchInput
                              , class "w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 pl-9 text-white text-sm focus:border-blue-500 focus:outline-none"
                              ]
                              []
                          , div [ class "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" ]
                              [ text "🔍" ]
                          , if not (String.isEmpty model.searchQuery) then
                              button
                                  [ onClick (SearchInput "")
                                  , class "absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                  ]
                                  [ text "✕" ]
                            else
                              text ""
                          ]
                      ]
                , -- Results counter
                  div [ class "px-4 py-2 text-xs text-gray-500" ]
                      [ text (String.fromInt (List.length (filteredClips model.searchQuery clips)) ++ " of " ++ String.fromInt (List.length clips)) ]
                , -- Clip list
                  div [ class "p-2" ]
                      (List.map (viewClip model.expandedClipId model.deleteConfirmId) (filteredClips model.searchQuery clips))
                ]
        ]


viewClip : Maybe String -> Maybe String -> Clip -> Html Msg
viewClip expandedId deleteConfirmId clip =
    div [ class "bg-gray-700 rounded mb-2 overflow-hidden hover:bg-gray-600 transition-colors" ]
        [ -- Main clip card
          div
              [ class "p-3 cursor-pointer"
              , onClick (ExpandClip clip.id)
              , attribute "draggable" "true"
              , on "dragstart" (Decode.succeed (DragStart clip))
              ]
              [ div [ class "flex items-center space-x-3" ]
                  [ -- Thumbnail
                    case clip.thumbnail_path of
                        Just thumbPath ->
                            img
                                [ src ("asset://localhost/" ++ thumbPath)
                                , class "w-12 h-12 object-cover rounded border border-gray-600"
                                , alt "thumbnail"
                                ]
                                []

                        Nothing ->
                            div [ class "w-12 h-12 bg-gray-600 rounded flex items-center justify-center text-gray-400 text-xs" ]
                                [ text "🎥" ]
                  , -- Clip info
                    div [ class "flex-1 min-w-0" ]
                        [ div [ class "text-sm text-white font-medium truncate" ] [ text clip.fileName ]
                        , div [ class "text-xs text-gray-400 flex items-center space-x-2" ]
                            [ span [] [ text (formatDuration clip.duration) ]
                            , span [] [ text "•" ]
                            , span [] [ text clip.resolution ]
                            , case clip.file_size of
                                Just size ->
                                    span [] [ text ("• " ++ formatFileSize size) ]

                                Nothing ->
                                    text ""
                            ]
                        ]
                  ]
              ]
        , -- Expanded details
          if expandedId == Just clip.id then
              div [ class "px-3 pb-3 border-t border-gray-600" ]
                  [ -- Metadata grid
                    div [ class "grid grid-cols-2 gap-2 text-xs mt-2" ]
                        [ case clip.codec of
                            Just codec ->
                                div []
                                    [ div [ class "text-gray-500" ] [ text "Codec" ]
                                    , div [ class "text-gray-300 font-mono" ] [ text (String.toUpper codec) ]
                                    ]

                            Nothing ->
                                text ""
                        , case clip.fps of
                            Just fps ->
                                div []
                                    [ div [ class "text-gray-500" ] [ text "Frame Rate" ]
                                    , div [ class "text-gray-300" ] [ text (String.fromFloat fps ++ " fps") ]
                                    ]

                            Nothing ->
                                text ""
                        , case clip.bit_rate of
                            Just bitrate ->
                                div []
                                    [ div [ class "text-gray-500" ] [ text "Bit Rate" ]
                                    , div [ class "text-gray-300" ] [ text (formatBitRate bitrate) ]
                                    ]

                            Nothing ->
                                text ""
                        , div []
                            [ div [ class "text-gray-500" ] [ text "Duration" ]
                            , div [ class "text-gray-300" ] [ text (formatDuration clip.duration) ]
                            ]
                        ]
                  , -- Action buttons
                    div [ class "flex gap-1 mt-3 border-t border-gray-600 pt-2" ]
                        [ button
                            [ class "flex-1 py-1.5 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            , onClick (ExpandClip clip.id) -- Keep expanded
                            ]
                            [ text "More" ]
                        , button
                            [ class "py-1.5 px-3 text-xs text-red-400 hover:text-red-300 hover:bg-gray-600 rounded transition-colors"
                            , onClick (ConfirmDelete clip.id)
                            ]
                            [ text "🗑️ Delete" ]
                        ]
                  ]
          else
              text ""
        , -- Delete confirmation
          case deleteConfirmId of
              Just confirmId ->
                  if confirmId == clip.id then
                      div [ class "p-3 bg-red-900 border-t border-red-700" ]
                          [ div [ class "text-sm text-white mb-2" ] [ text ("Delete \"" ++ clip.fileName ++ "\"?") ]
                          , div [ class "flex gap-2" ]
                              [ button
                                  [ class "flex-1 py-1 px-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                                  , onClick (DeleteConfirmed clip.id)
                                  ]
                                  [ text "Delete" ]
                              , button
                                  [ class "flex-1 py-1 px-2 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
                                  , onClick CancelDelete
                                  ]
                                  [ text "Cancel" ]
                              ]
                          ]
                  else
                      text ""

              Nothing ->
                  text ""
        ]


filteredClips : String -> List Clip -> List Clip
filteredClips query clips =
    if String.isEmpty query then
        clips
    else
        let
            lowerQuery =
                String.toLower query
        in
                List.filter
            (\clip ->
                String.contains lowerQuery (String.toLower clip.fileName)
                    || (clip.codec |> Maybe.map (String.contains lowerQuery << String.toLower) |> Maybe.withDefault False)
                    || String.contains lowerQuery (String.toLower clip.resolution)
                    || (clip.file_size |> Maybe.map ((formatFileSize >> String.toLower) >> String.contains lowerQuery) |> Maybe.withDefault False)
                    || (clip.fps |> Maybe.map (String.fromFloat >> String.contains lowerQuery) |> Maybe.withDefault False)
            )
            clips


encodeClipForDrag : Clip -> Encode.Value
encodeClipForDrag clip =
    Encode.object
        [ ( "id", Encode.string clip.id )
        , ( "path", Encode.string clip.path )
        , ( "fileName", Encode.string clip.fileName )
        , ( "duration", Encode.float clip.duration )
        , ( "resolution", Encode.string clip.resolution )
        , ( "file_size", clip.file_size |> Maybe.map Encode.int |> Maybe.withDefault Encode.null )
        , ( "codec", clip.codec |> Maybe.map Encode.string |> Maybe.withDefault Encode.null )
        , ( "fps", clip.fps |> Maybe.map Encode.float |> Maybe.withDefault Encode.null )
        , ( "bit_rate", clip.bit_rate |> Maybe.map Encode.int |> Maybe.withDefault Encode.null )
        , ( "thumbnail_path", clip.thumbnail_path |> Maybe.map Encode.string |> Maybe.withDefault Encode.null )
        ]


formatDuration : Float -> String
formatDuration seconds =
    let
        mins =
            floor (seconds / 60)

        secs =
            round (seconds - toFloat (mins * 60))
    in
    String.fromInt mins ++ ":" ++ String.padLeft 2 '0' (String.fromInt secs)


formatFileSize : Int -> String
formatFileSize bytes =
    if bytes < 1024 then
        String.fromInt bytes ++ " B"
    else if bytes < 1024 * 1024 then
        String.fromFloat (toFloat (round (toFloat bytes / 1024 * 10)) / 10) ++ " KB"
    else if bytes < 1024 * 1024 * 1024 then
        String.fromFloat (toFloat (round (toFloat bytes / (1024 * 1024) * 10)) / 10) ++ " MB"
    else
        String.fromFloat (toFloat (round (toFloat bytes / (1024 * 1024 * 1024) * 100)) / 100) ++ " GB"


formatBitRate : Int -> String
formatBitRate bps =
    if bps < 1000 then
        String.fromInt bps ++ " bps"
    else if bps < 1000000 then
        String.fromFloat (toFloat (round (toFloat bps / 1000 * 10)) / 10) ++ " kbps"
    else
        String.fromFloat (toFloat (round (toFloat bps / 1000000 * 10)) / 10) ++ " Mbps"


-- PORTS


port deleteClip : String -> Cmd msg